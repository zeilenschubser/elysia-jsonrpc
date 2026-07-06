import { z } from 'zod/v4'
import { expectTypeOf } from 'expect-type';

export const methodDefs = {
  initialize: {
    params: z.object({
      protocolVersion: z.string(),
      capabilities: z.any(), // TODO,
      clientInfo: z.any(), // TODO
    }),
    result: z.object({
      protocolVersion: z.string(),
      capabilities: z.any(), // TODO,
      serverInfo: z.any(), // TODO
    })
  },
  ping: {
    params: z.object({}),
    result: z.object({})
  },
  prompts: {
    list: {
      params: z.object({
        cursor: z.string().optional()
      }),
      result: z.object({
        prompts: z.array(z.object({
          name: z.string(),
          description: z.string().optional(),
          arguments: z.array(z.object({
            name: z.string(),
            description: z.string().optional(),
            required: z.boolean().optional()
          })).optional()
        })),
        nextCursor: z.string().optional()
      }),
      description: "",
    },
    get: {
      params: z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.string()).optional()
      }),
      result: z.object({
        description: z.string().optional(),
        messages: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.object({
            type: z.literal('text'),
            text: z.string()
          })
        }))
      })
    }
  },
  resources: {
    list: {
      params: z.object({
        cursor: z.string().optional()
      }),
      result: z.object({
        resources: z.array(z.object({
          uri: z.string(),
          name: z.string(),
          description: z.string().optional(),
          mimeType: z.string().optional()
        })),
        nextCursor: z.string().optional()
      })
    },
    read: {
      params: z.object({
        uri: z.string()
      }),
      result: z.object({
        contents: z.array(z.object({
          uri: z.string(),
          mimeType: z.string().optional(),
          text: z.string().optional(),
          blob: z.string().optional()
        }))
      })
    },
    subscribe: {
      params: z.object({
        uri: z.string()
      }),
      result: z.object({})
    },
    templates: {
      list: {
        params: z.object({
          cursor: z.string().optional()
        }),
        result: z.object({
          resourceTemplates: z.array(z.object({
            uriTemplate: z.string(),
            name: z.string(),
            description: z.string().optional(),
            mimeType: z.string().optional()
          })),
          nextCursor: z.string().optional()
        })
      }
    }
  },
  tools: {
    list: {
      params: z.object({
        cursor: z.string().optional()
      }),
      result: z.object({
        tools: z.array(z.object({
          name: z.string(),
          description: z.string().optional(),
          inputSchema: z.object({
            type: z.literal('object'),
            properties: z.record(z.string(), z.any()).optional(),
            required: z.array(z.string()).optional()
          })
        })),
        nextCursor: z.string().optional()
      })
    },
    call: {
      params: z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.any()).optional()
      }),
      result: z.object({
        content: z.array(z.object({
          type: z.enum(['text', 'image', 'resource']),
          text: z.string().optional(),
          data: z.string().optional(),
          mimeType: z.string().optional()
        })),
        isError: z.boolean().optional()
      })
    }
  },
  notifications: {
    'prompts/list_changed': null,
    'resources/list_changed': null,
    'resources/updated': null,
    'tools/list_changed': null,
    cancelled: null
  }
} as const

export class MCPError extends Error {
  constructor(message: string, readonly args?: object) {
    super(`MCPError: ${message} with args ${args || {}}`);
  }
}

// Type extraction
type ExtractMethod<T> = T extends {
  readonly params: z.ZodType<infer P>;
  readonly result: z.ZodType<infer R>
} | {
  params: z.ZodType<infer P>;
  result: z.ZodType<infer R>
}
  ? (params: P) => Promise<R>
  : T extends {
      readonly params: infer P1;
      readonly result: infer R2
    } | {
      params: infer P1;
      result: infer R2
    }
  ? (params: P1) => Promise<R2>
  : never;

type ExtractNamespace<T> = {
  -readonly [K in keyof T]: T[K] extends { params: any; result: any }
    ? ExtractMethod<T[K]>
    : T[K] extends null
    ? null
    : ExtractNamespace<T[K]>
};
// Flatten nested namespaces with prefix
type FlattenNamespace<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends (params: infer P) => Promise<infer R>
    ? Prefix extends ''
      ? { [Key in K]: (params: P) => Promise<R> }
      : { [Key in `${Prefix}/${K & string}`]: (params: P) => Promise<R> }
    : T[K] extends Record<string, any>
    ? FlattenNamespace<T[K], Prefix extends '' ? K & string : `${Prefix}/${K & string}`>
    : never;
}[keyof T];

// Merge all flattened types into one object
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type MCPServerSrc = ExtractNamespace<typeof methodDefs>
type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type MCPServer = Simplify<UnionToIntersection<
  | { initialize: MCPServerSrc['initialize'] }
  | { ping: MCPServerSrc['ping'] }
  | FlattenNamespace<MCPServerSrc['tools'], 'tools'>
  | FlattenNamespace<MCPServerSrc['prompts'], 'prompts'>
  | FlattenNamespace<MCPServerSrc['resources'], 'resources'>
  | FlattenNamespace<MCPServerSrc['notifications'], 'notifications'>
  >>;
export interface MCPServerInterface {
  initialize(params: InitializeParams): Promise<InitializeResult>
  ping(params: PingParams): Promise<PingResult>;
  'tools/list'(params: ToolsListParams): Promise<ToolsListResult>;
  'tools/call'(params: ToolsCallParams): Promise<ToolsCallResult>;
  'prompts/list'(params: PromptsListParams): Promise<PromptsListResult>;
  'prompts/get'(params: PromptsGetParams): Promise<PromptsGetResult>;
  'resources/list'(params: ResourcesListParams): Promise<ResourcesListResult> ;
  'resources/read'(params: ResourcesReadParams): Promise<ResourcesReadResult> ;
  "resources/subscribe"(params: ResourcesSubscribeParams): Promise<ResourcesSubscribeResult>;
  "resources/templates/list"(params: ResourcesTemplatesListParams): Promise<ResourcesTemplatesListResult>;
}
expectTypeOf<MCPServer>().toEqualTypeOf<MCPServerInterface>();


// Export individual param/result types
export type InitializeParams = z.infer<typeof methodDefs.initialize.params>
export type InitializeResult = z.infer<typeof methodDefs.initialize.result>

export type PingParams = z.infer<typeof methodDefs.ping.params>
export type PingResult = z.infer<typeof methodDefs.ping.result>

export type PromptsListParams = z.infer<typeof methodDefs.prompts.list.params>
export type PromptsListResult = z.infer<typeof methodDefs.prompts.list.result>
export type PromptsGetParams = z.infer<typeof methodDefs.prompts.get.params>
export type PromptsGetResult = z.infer<typeof methodDefs.prompts.get.result>

export type ResourcesListParams = z.infer<typeof methodDefs.resources.list.params>
export type ResourcesListResult = z.infer<typeof methodDefs.resources.list.result>
export type ResourcesReadParams = z.infer<typeof methodDefs.resources.read.params>
export type ResourcesReadResult = z.infer<typeof methodDefs.resources.read.result>
export type ResourcesSubscribeParams = z.infer<typeof methodDefs.resources.subscribe.params>
export type ResourcesSubscribeResult = z.infer<typeof methodDefs.resources.subscribe.result>

export type ResourcesTemplatesListParams = z.infer<typeof methodDefs.resources.templates.list.params>
export type ResourcesTemplatesListResult = z.infer<typeof methodDefs.resources.templates.list.result>

export type ToolsListParams = z.infer<typeof methodDefs.tools.list.params>
export type ToolsListResult = z.infer<typeof methodDefs.tools.list.result>
export type ToolsCallParams = z.infer<typeof methodDefs.tools.call.params>
export type ToolsCallResult = z.infer<typeof methodDefs.tools.call.result>


expectTypeOf< ExtractNamespace< { readonly ping: typeof methodDefs.ping } >>().not.toEqualTypeOf<{
    readonly ping: (params: Record<string, never>) => Promise<Record<string, never>>;
}>();
expectTypeOf<ExtractNamespace<{ readonly ping: typeof methodDefs.ping }>>().not.toEqualTypeOf<{
    readonly ping: (params: PingParams) => Promise<PingResult>;
}>();
expectTypeOf<ExtractNamespace<{ ping: typeof methodDefs.ping }>>().toEqualTypeOf<{
    ping(params: PingParams): Promise<PingResult>;
}>();
expectTypeOf<ExtractNamespace<{ readonly ping: typeof methodDefs.ping }>>().toEqualTypeOf<{
    ping(params: PingParams): Promise<PingResult>;
}>();

expectTypeOf({ a: 1, b: 1 }).toMatchObjectType<{ a: number }>()

expectTypeOf<MCPServer>().toEqualTypeOf<{
  'initialize': (params: InitializeParams) => Promise<InitializeResult>;
  'ping': (params: PingParams) => Promise<PingResult>;
  'tools/list'(params: ToolsListParams): Promise<ToolsListResult>;
  'tools/call'(params: ToolsCallParams): Promise<ToolsCallResult>;
  'prompts/list'(params: PromptsListParams): Promise<PromptsListResult>;
  'prompts/get'(params: PromptsGetParams): Promise<PromptsGetResult>;
  'resources/list'(params: ResourcesListParams): Promise<ResourcesListResult>;
  'resources/read'(params: ResourcesReadParams): Promise<ResourcesReadResult>;
  'resources/subscribe'(params: ResourcesSubscribeParams): Promise<ResourcesSubscribeResult>;
  'resources/templates/list'(params: ResourcesTemplatesListParams): Promise<ResourcesTemplatesListResult>;
}>();
type AllNamespaceKeys = keyof MCPServer;
expectTypeOf<MCPServer['ping']>().toEqualTypeOf<(params: PingParams) => Promise<PingResult>>();
expectTypeOf<MCPServer['ping']>().toEqualTypeOf<(params: PingParams) => Promise<PingResult>>();
expectTypeOf<MCPServer['tools/list']>().toEqualTypeOf<(params: ToolsListParams) => Promise<ToolsListResult>>();
expectTypeOf<MCPServer['tools/call']>().toEqualTypeOf<(params: ToolsCallParams) => Promise<ToolsCallResult>>();
expectTypeOf<MCPServer['prompts/list']>().toEqualTypeOf<(params: PromptsListParams) =>  Promise<PromptsListResult>>();
expectTypeOf<MCPServer['prompts/get']>().toEqualTypeOf<(params: PromptsGetParams) =>  Promise<PromptsGetResult>>();
expectTypeOf<MCPServer['resources/list']>().toEqualTypeOf<(params: ResourcesListParams) =>  Promise<ResourcesListResult>>();
expectTypeOf<MCPServer['resources/read']>().toEqualTypeOf<(params: ResourcesReadParams) =>  Promise<ResourcesReadResult>>();
expectTypeOf<MCPServer['resources/subscribe']>().toEqualTypeOf<(params: ResourcesSubscribeParams) =>  Promise<ResourcesSubscribeResult>>();
expectTypeOf<MCPServer['resources/templates/list']>().toEqualTypeOf<(params: ResourcesTemplatesListParams) =>  Promise<ResourcesTemplatesListResult>>();

expectTypeOf<ExtractNamespace<{ test: { readonly ping: { readonly params: object; readonly result: object; } } }>>().toEqualTypeOf<{
  test: {
    ping: (params: object) => Promise<object>;
  };
}>();
expectTypeOf<ExtractNamespace<{ test: { readonly ping: { readonly params: z.ZodType<object>; readonly result: z.ZodType<number>; } } }>>().toEqualTypeOf<{
  test: {
    ping: (params: object) => Promise<number>;
  };
}>();
expectTypeOf<ExtractNamespace<{
        readonly ping: {
            readonly params: z.ZodType<object>;
            readonly result: z.ZodType<number>;
        };
}>>().toEqualTypeOf<{
    ping: (params: object) => Promise<number>;
}>();
expectTypeOf<ExtractNamespace<{ ping: { readonly params: z.ZodType<object>; readonly result: z.ZodType<number>; } }>>().toEqualTypeOf<{
  ping: (params: object) => Promise<number>
}>();
expectTypeOf<ExtractMethod<{ readonly params: z.ZodType<object>; readonly result: z.ZodType<number>; }>>().toEqualTypeOf<(params: object) => Promise<number>>();
