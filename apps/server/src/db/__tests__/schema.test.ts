import { describe, expect, it } from 'vitest';

import { eventDocumentSchema } from '../schemas/event.schema.js';
import { merchandiseItemDocumentSchema } from '../schemas/merchandise.schema.js';
import { safeUserSchema, userDocumentSchema } from '../schemas/user.schema.js';

describe('Schema Validations', () => {
  const mockObjectId = '507f1f77bcf86cd799439011';

  describe('User Schema', () => {
    it('should validate a valid user document', () => {
      const validUser = {
        email: 'test@example.com',
        passwordHash: 'hashed_password_mock',
        displayName: 'Test User',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = userDocumentSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidUser = {
        email: 'not-an-email',
        passwordHash: 'hashed_password_mock',
        displayName: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = userDocumentSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('safeUserSchema should strip sensitive fields', () => {
      const validUser = {
        email: 'test@example.com',
        passwordHash: 'hashed_password_mock',
        displayName: 'Test User',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const parsed = userDocumentSchema.parse(validUser);
      const safe = safeUserSchema.parse(parsed);

      expect(safe).not.toHaveProperty('passwordHash');
      expect(safe.email).toBe('test@example.com');
    });
  });

  describe('Event Schema', () => {
    it('should allow valid event with member and non-member pricing', () => {
      const event = {
        clubId: mockObjectId,
        createdBy: mockObjectId,
        title: 'Spring Gala',
        description: 'Annual Spring Gala',
        startsAt: new Date('2030-05-01T18:00:00Z'),
        endsAt: new Date('2030-05-01T23:00:00Z'),
        isPublished: true,
        hasTickets: true,
        ticketCapacity: 100,
        remainingTicketCount: 100,
        memberPriceCents: 1500,
        nonMemberPriceCents: 3000,
        currency: 'INR',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = eventDocumentSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('Merchandise Schema', () => {
    it('should support size-based variants', () => {
      const item = {
        clubId: mockObjectId,
        createdBy: mockObjectId,
        name: 'Club T-Shirt',
        priceCents: 2000,
        currency: 'INR',
        variants: [
          { size: 'M', stockQuantity: 50 },
          { size: 'L', stockQuantity: 20 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = merchandiseItemDocumentSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variants).toHaveLength(2);
      }
    });
  });
});
