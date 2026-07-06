import z from 'zod/v4'

export const JSONRPC_VERSION = '2.0'
export const OPENRPC_VERSION = '1.3.2'

export const JSONRPCSchema = z.string() // we can't have parse errors
export const JSONRPCSupportedVersionsSchema = z.enum([JSONRPC_VERSION])
export const OpenRPCSupportedVersionsSchema = z.enum([OPENRPC_VERSION])

// Loose ID schema - accepts string, number, or null
export const JSONRPCRequestIdSchema = z.union([
	z.string(),
	z.number(),
	z.null()
])

// Loose params - can be array, object, or omitted
export const JSONRPCParamsSchema = z
	.union([z.array(z.unknown()), z.record(z.any(), z.unknown())])
	.optional()

// Error object structure
export const JSONRPCErrorSchema = z.object({
	code: z.number().int(),
	message: z.string(),
	data: z.unknown().optional()
})

// Request object (with id) - loose method validation
export const JSONRPCRequestSchema = z.object({
	jsonrpc: JSONRPCSchema,
	method: z.string(),
	params: JSONRPCParamsSchema,
	id: JSONRPCRequestIdSchema
})

// Notification object (without id)
export const JSONRPCNotificationSchema = z.object({
	jsonrpc: JSONRPCSchema,
	method: z.string(),
	params: JSONRPCParamsSchema
})

// Result can be any JSON value
export const JSONRPCResultSchema = z.unknown()

// Success response
export const JSONRPCResultResponseSchema = z.object({
	jsonrpc: JSONRPCSchema,
	result: JSONRPCResultSchema,
	id: JSONRPCRequestIdSchema
})

// Error response
export const JSONRPCErrorResponseSchema = z.object({
	jsonrpc: JSONRPCSchema,
	error: JSONRPCErrorSchema,
	id: JSONRPCRequestIdSchema
})

// Response can be either success or error
export const JSONRPCResponseSchema = z.union([
	JSONRPCResultResponseSchema,
	JSONRPCErrorResponseSchema
])

// Message can be request, notification, or response
export const JSONRPCMessageSchema = z.union([
	JSONRPCRequestSchema,
	JSONRPCNotificationSchema,
	JSONRPCResponseSchema
])

export const JSONRPCHandlerArgumentSchema = z.union([
	JSONRPCRequestSchema,
	JSONRPCNotificationSchema
])

export const JSONRPCHandlerReturnTypeSchema = z.union([
	JSONRPCResponseSchema,
	JSONRPCNotificationSchema
])

// Type exports
export type JSONRPCSupportedVersions = z.infer<typeof JSONRPCSchema>
export type JSONRPCRequestId = z.infer<typeof JSONRPCRequestIdSchema>
export type JSONRPCParams = z.infer<typeof JSONRPCParamsSchema>
export type JSONRPCError = z.infer<typeof JSONRPCErrorSchema>
export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>
export type JSONRPCMessage = z.infer<typeof JSONRPCMessageSchema>
export type JSONRPCResult = z.infer<typeof JSONRPCResultSchema>
export type JSONRPCNotification = z.infer<typeof JSONRPCNotificationSchema>
export type JSONRPCResultResponse = z.infer<typeof JSONRPCResultResponseSchema>
export type JSONRPCErrorResponse = z.infer<typeof JSONRPCErrorResponseSchema>
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>

export type JSONRPCHandlerArgument = z.infer<
	typeof JSONRPCHandlerArgumentSchema
>
export type JSONRPCHandlerReturnType = z.infer<
	typeof JSONRPCHandlerReturnTypeSchema
>

// Predefined error codes as constants (for convenience)
export const JSONRPCErrorCode = {
	ParseError: -32700,
	InvalidRequest: -32600,
	MethodNotFound: -32601,
	InvalidParams: -32602,
	InternalError: -32603
	// -32000 to -32099 are reserved for implementation-defined server errors
} as const

export const OpenRPCContactObjectSchema = z.object({
	name: z.string().optional(),
	url: z.url().optional(),
	email: z.email().optional()
})

export const OpenRPCLicenseObjectSchema = z.object({
	name: z.string(),
	url: z.url().optional()
})

export const OpenRPCInfoObjectSchema = z.object({
	title: z.string(),
	version: z.string(),
	description: z.string().optional(),
	termsOfService: z.string().optional(),
	contact: OpenRPCContactObjectSchema.optional(),
	license: OpenRPCLicenseObjectSchema.optional()
})
// Server Object
export const OpenRPCServerObjectSchema = z.object({
	name: z.string(),
	url: z.string(),
	summary: z.string().optional(),
	description: z.string().optional(),
	variables: z.record(z.string(), z.any()).optional()
})

// Content Descriptor
export const OpenRPCContentDescriptorSchema = z.object({
	name: z.string(),
	summary: z.string().optional(),
	description: z.string().optional(),
	required: z.boolean().optional(),
	schema: z.any(), // JSON Schema
	deprecated: z.boolean().optional()
})

// Method Object
export const OpenRPCMethodObjectSchema = z.object({
	name: z.string(),
	tags: z
		.array(
			z.object({
				name: z.string(),
				description: z.string().optional()
			})
		)
		.optional(),
	summary: z.string().optional(),
	description: z.string().optional(),
	externalDocs: z
		.object({
			description: z.string().optional(),
			url: z.string()
		})
		.optional(),
	params: z.array(OpenRPCContentDescriptorSchema).optional(),
	result: OpenRPCContentDescriptorSchema,
	deprecated: z.boolean().optional(),
	servers: z.array(OpenRPCServerObjectSchema).optional(),
	errors: z.array(z.any()).optional(),
	links: z.array(z.any()).optional(),
	examples: z.array(z.any()).optional(),
	paramStructure: z.enum(['by-name', 'by-position', 'either']).optional()
})

// Reference Object
export const OpenRPCReferenceObjectSchema = z.object({
	$ref: z.string()
})

// Components Object
export const OpenRPCComponentsObjectSchema = z.object({
	schemas: z.record(z.string(), z.any()).optional(),
	links: z.record(z.string(), z.any()).optional(),
	errors: z.record(z.string(), z.any()).optional(),
	examples: z.record(z.string(), z.any()).optional(),
	examplePairings: z.record(z.string(), z.any()).optional(),
	contentDescriptors: z
		.record(z.string(), OpenRPCContentDescriptorSchema)
		.optional(),
	tags: z.record(z.string(), z.any()).optional()
})

// External Documentation Object
export const OpenRPCExternalDocumentationObjectSchema = z.object({
	description: z.string().optional(),
	url: z.string()
})

export const OpenRPCSchema = z.object({
	openrpc: z.string(),
	info: OpenRPCInfoObjectSchema,
	servers: z.array(OpenRPCServerObjectSchema).optional(),
	methods: z.array(z.union([OpenRPCMethodObjectSchema, OpenRPCReferenceObjectSchema])),
	components: OpenRPCComponentsObjectSchema.optional(),
	externalDocs: OpenRPCExternalDocumentationObjectSchema.optional()
})

export type OpenRPCSupportedVersions = z.infer<
	typeof OpenRPCSupportedVersionsSchema
>
export type OpenRPC = z.infer<typeof OpenRPCSchema>
export type OpenRPCContactObject = z.infer<typeof OpenRPCContactObjectSchema>
export type OpenRPCLicenseObject = z.infer<typeof OpenRPCLicenseObjectSchema>
export type OpenRPCInfoObject = z.infer<typeof OpenRPCInfoObjectSchema>
export type OpenRPCServerObject = z.infer<typeof OpenRPCServerObjectSchema>
export type OpenRPCMethodObject = z.infer<typeof OpenRPCMethodObjectSchema>
export type OpenRPCReferenceObject = z.infer<
	typeof OpenRPCReferenceObjectSchema
>
export type OpenRPCComponentsObject = z.infer<
	typeof OpenRPCComponentsObjectSchema
>
export type OpenRPCExternalDocumentationObject = z.infer<
	typeof OpenRPCExternalDocumentationObjectSchema
>

export class JSONRPCException extends Error {
  constructor(
    readonly code: number,
    readonly message: string,
    readonly originalError?: Error
  ) {
    super(`JSONRPCException ${code}: ${message}`)
  }
}
