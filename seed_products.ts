import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const client = new MongoClient('mongodb://localhost:27017/student_club?directConnection=true');
  await client.connect();
  const db = client.db('student_club');
  
  const clubId = "60c72b2f9b1d8b001c8e4d1a"; // Using a dummy clubId, wait let's get the actual clubId from existing products
  const existingProduct = await db.collection('products').findOne({});
  const actualClubId = existingProduct ? existingProduct.clubId : "default_club";
  const createdBy = existingProduct ? existingProduct.createdBy : new ObjectId().toHexString();

  const products = [
    {
      clubId: actualClubId,
      createdBy: createdBy,
      name: 'Club T-Shirt',
      priceCents: 1500,
      currency: 'INR',
      imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80',
      variants: [
        { size: 'S', stockQuantity: 10 },
        { size: 'M', stockQuantity: 20 },
        { size: 'L', stockQuantity: 15 }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      clubId: actualClubId,
      createdBy: createdBy,
      name: 'Club Cap',
      priceCents: 800,
      currency: 'INR',
      imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&q=80',
      variants: [
        { size: 'One Size', stockQuantity: 30 }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      clubId: actualClubId,
      createdBy: createdBy,
      name: 'Club Mug',
      priceCents: 500,
      currency: 'INR',
      imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500&q=80',
      variants: [
        { size: 'Standard', stockQuantity: 50 }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  await db.collection('products').insertMany(products);
  console.log('Seed products inserted successfully');
  process.exit(0);
}
run().catch(console.error);
