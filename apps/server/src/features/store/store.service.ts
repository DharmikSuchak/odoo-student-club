import { ObjectId, type Db } from 'mongodb';

import {
  merchandiseItemDocumentSchema,
  orderDocumentSchema,
  type MerchandiseItemDocument,
  type MerchandiseVariant,
  type OrderDocument,
} from '../../db/schemas/merchandise.schema.js';
import { AppError } from '../../middleware/error-handler.js';

export type StoredMerchandiseItem = MerchandiseItemDocument & { _id: ObjectId };
export type StoredOrder = OrderDocument & { _id: ObjectId };

export interface ProductInput {
  clubId: string;
  createdBy: string;
  name: string;
  priceCents: number;
  currency: string;
  variants: MerchandiseVariant[];
}

export interface ProductUpdateInput {
  name: string;
  priceCents: number;
  currency: string;
  variants: MerchandiseVariant[];
}

export interface PlaceOrderInput {
  clubId: string;
  userId: string;
  itemId: string;
  size: string;
}

function parseObjectId(value: string, fieldName: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(value);
}

function normalizeVariants(variants: MerchandiseVariant[]): MerchandiseVariant[] {
  const normalized = variants.map((variant) => ({
    size: variant.size.trim().toUpperCase(),
    stockQuantity: variant.stockQuantity,
  }));
  const sizes = normalized.map((variant) => variant.size);
  if (new Set(sizes).size !== sizes.length) {
    throw new AppError('Each size variant must be unique.', 422);
  }
  return normalized;
}

export async function listProducts(database: Db, clubId: string): Promise<StoredMerchandiseItem[]> {
  return database
    .collection('merchandiseItems')
    .find<StoredMerchandiseItem>(
      { clubId: parseObjectId(clubId, 'clubId').toHexString() },
      { sort: { name: 1 } },
    )
    .toArray();
}

export async function getProduct(
  database: Db,
  clubId: string,
  itemId: string,
): Promise<StoredMerchandiseItem> {
  const product = await database.collection('merchandiseItems').findOne<StoredMerchandiseItem>({
    _id: parseObjectId(itemId, 'itemId'),
    clubId: parseObjectId(clubId, 'clubId').toHexString(),
  });
  if (product === null) throw new AppError('Product not found.', 404);
  return product;
}

export async function createProduct(
  database: Db,
  input: ProductInput,
): Promise<StoredMerchandiseItem> {
  const now = new Date();
  const document = merchandiseItemDocumentSchema.parse({
    ...input,
    clubId: parseObjectId(input.clubId, 'clubId').toHexString(),
    createdBy: parseObjectId(input.createdBy, 'createdBy').toHexString(),
    currency: input.currency.toUpperCase(),
    variants: normalizeVariants(input.variants),
    createdAt: now,
    updatedAt: now,
  });
  const result = await database.collection('merchandiseItems').insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function updateProduct(
  database: Db,
  clubId: string,
  itemId: string,
  input: ProductUpdateInput,
): Promise<StoredMerchandiseItem> {
  const existing = await getProduct(database, clubId, itemId);
  const fields = merchandiseItemDocumentSchema
    .pick({ name: true, priceCents: true, currency: true, variants: true, updatedAt: true })
    .parse({
      ...input,
      currency: input.currency.toUpperCase(),
      variants: normalizeVariants(input.variants),
      updatedAt: new Date(),
    });
  const updated = await database
    .collection('merchandiseItems')
    .findOneAndUpdate(
      { _id: existing._id, clubId: existing.clubId },
      { $set: fields },
      { returnDocument: 'after' },
    );
  if (updated === null) throw new AppError('Product changed before it could be saved.', 409);
  return updated as StoredMerchandiseItem;
}

// The stock predicate and decrement are atomic; the order insert shares this transaction.
export async function placeOrder(database: Db, input: PlaceOrderInput): Promise<StoredOrder> {
  const clubId = parseObjectId(input.clubId, 'clubId').toHexString();
  const itemId = parseObjectId(input.itemId, 'itemId');
  const userId = parseObjectId(input.userId, 'userId').toHexString();
  const size = input.size.trim().toUpperCase();
  const session = database.client.startSession();
  try {
    return await session.withTransaction(async () => {
      const now = new Date();
      const product = await database
        .collection('merchandiseItems')
        .findOneAndUpdate(
          { _id: itemId, clubId, variants: { $elemMatch: { size, stockQuantity: { $gt: 0 } } } },
          { $inc: { 'variants.$.stockQuantity': -1 }, $set: { updatedAt: now } },
          { returnDocument: 'after', session },
        );
      if (product === null) {
        const existing = await database
          .collection('merchandiseItems')
          .findOne({ _id: itemId, clubId }, { session });
        if (existing === null) throw new AppError('Product not found.', 404);
        const hasSize = (existing['variants'] as MerchandiseVariant[]).some(
          (variant) => variant.size === size,
        );
        if (!hasSize) throw new AppError('That size is not offered for this product.', 409);
        throw new AppError('That size is out of stock.', 409);
      }
      const reserved = product as StoredMerchandiseItem;
      const document = orderDocumentSchema.parse({
        userId,
        clubId,
        itemId: itemId.toHexString(),
        itemName: reserved.name,
        size,
        quantity: 1,
        unitPriceCents: reserved.priceCents,
        totalCents: reserved.priceCents,
        currency: reserved.currency,
        status: 'pending_payment',
        createdAt: now,
        updatedAt: now,
      });
      const result = await database.collection('orders').insertOne(document, { session });
      return { ...document, _id: result.insertedId };
    });
  } finally {
    await session.endSession();
  }
}

export async function listOrders(
  database: Db,
  clubId: string,
  userId: string,
): Promise<StoredOrder[]> {
  return database
    .collection('orders')
    .find<StoredOrder>(
      {
        clubId: parseObjectId(clubId, 'clubId').toHexString(),
        userId: parseObjectId(userId, 'userId').toHexString(),
      },
      { sort: { createdAt: -1 } },
    )
    .toArray();
}
