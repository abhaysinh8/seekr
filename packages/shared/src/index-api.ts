import { z } from 'zod';

import { entityIdSchema } from './entities.js';

const fieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/u);
const scalarSchema = z.union([z.string().max(1_000_000), z.number().finite(), z.boolean()]);
export const documentFieldValueSchema = z.union([
  scalarSchema,
  z.array(scalarSchema).max(10_000),
  z.null(),
]);

export const indexFieldSchema = z
  .object({
    type: z.enum(['text', 'string', 'number', 'boolean', 'date']),
    searchable: z.boolean().default(false),
    filterable: z.boolean().default(false),
    facetable: z.boolean().default(false),
    sortable: z.boolean().default(false),
    weight: z.number().positive().max(100).default(1),
  })
  .superRefine((field, context) => {
    if (field.searchable && field.type !== 'text' && field.type !== 'string') {
      context.addIssue({ code: 'custom', message: 'Only text or string fields can be searchable' });
    }
    if (field.facetable && !field.filterable) {
      context.addIssue({ code: 'custom', message: 'Facetable fields must also be filterable' });
    }
  });

export const indexSchemaConfigurationSchema = z.object({
  fields: z
    .record(fieldNameSchema, indexFieldSchema)
    .refine((fields) => Object.keys(fields).length <= 128, {
      message: 'An index may define at most 128 fields',
    }),
});

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  ownerEmail: z.string().email().max(320),
});

export const createIndexRequestSchema = z.object({
  projectId: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  schema: indexSchemaConfigurationSchema,
});

export const updateIndexSchemaRequestSchema = z.object({ schema: indexSchemaConfigurationSchema });
export const managedIndexIdParametersSchema = z.object({ indexId: entityIdSchema });
export const documentParametersSchema = z.object({
  indexId: entityIdSchema,
  documentId: z.string().trim().min(1).max(255),
});
export const listIndexesQuerySchema = z.object({ projectId: entityIdSchema.optional() });
export const listDocumentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
export const addDocumentRequestSchema = z.object({
  id: z.string().trim().min(1).max(255),
  fields: z.record(fieldNameSchema, documentFieldValueSchema),
  metadata: z.record(fieldNameSchema, documentFieldValueSchema).default({}),
});
export const bulkDocumentsRequestSchema = z.object({
  documents: z.array(addDocumentRequestSchema).min(1).max(1000),
});

export type IndexFieldApi = z.infer<typeof indexFieldSchema>;
export type IndexSchemaConfigurationApi = z.infer<typeof indexSchemaConfigurationSchema>;
export type CreateProjectApiRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateIndexApiRequest = z.infer<typeof createIndexRequestSchema>;
export type AddDocumentApiRequest = z.infer<typeof addDocumentRequestSchema>;
