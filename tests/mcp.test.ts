import { Treaty, treaty } from '@elysiajs/eden'
import { describe, expect, it } from 'bun:test'
import Elysia from 'elysia'
import { ZodError } from 'zod'
import elysiaJsonRPC from '../src'
import {
  InitializeParams,
  InitializeResult,
  MCPServer,
  MCPServerInterface,
  PingParams,
  PingResult,
  PromptsGetParams,
  PromptsGetResult,
  PromptsListParams,
  PromptsListResult,
  ResourcesListParams,
  ResourcesListResult,
  ResourcesReadParams,
  ResourcesReadResult,
  ResourcesSubscribeParams,
  ResourcesSubscribeResult,
  ResourcesTemplatesListParams,
  ResourcesTemplatesListResult,
  ToolsCallParams,
  ToolsCallResult,
  ToolsListParams,
  ToolsListResult
} from '../src/mcp.types'
import {
  JSONRPCErrorCode,
  JSONRPCErrorResponseSchema,
  JSONRPCException,
  JSONRPCParams,
  JSONRPCRequest
} from '../src/rpc.types'

class MCPServerService implements MCPServerInterface {
  async initialize(params: InitializeParams): Promise<InitializeResult> {
    return {
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "logging": {},
        "prompts": {
          "listChanged": true
        },
        "resources": {
          "subscribe": true,
          "listChanged": true
        },
        "tools": {
          "listChanged": true
        }
      },
      "serverInfo": {
        "name": "ExampleServer",
        "title": "Example Server Display Name",
        "version": "1.0.0"
      },
      "instructions": "Optional instructions for the client"
    } as InitializeResult
  }
	async ping(params: PingParams): Promise<PingResult> {
		return {} as PingResult
	}
  async 'tools/list'(params: ToolsListParams): Promise<ToolsListResult> {
    // Return MCP v1 tools/list response format
    return {
      tools: [
        {
          name: 'asdf',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              arg: {
                type: 'string',
                description: 'A test argument'
              }
            },
            required: ['arg']
          }
        },
        {
          name: 'echo',
          description: 'Echoes back the input',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to echo'
              }
            }
          }
        }
      ]
    }
  }
  async 'tools/call'(params: ToolsCallParams): Promise<ToolsCallResult> {
    const tool: string = params.name
    const toolParams = params.arguments || {}
    // Simulate tool execution
    if (tool === 'asdf') {
      return {
        content: [
          {
            type: 'text',
            text: `Tool '${tool}' executed with params: ${JSON.stringify(toolParams)}`
          }
        ]
      }
    }
    throw new Error(`Tool '${tool}' not found`)
  }
  async 'prompts/list'(params: PromptsListParams): Promise<PromptsListResult> { return {} as PromptsListResult}
  async 'prompts/get'(params: PromptsGetParams): Promise<PromptsGetResult> { return {} as PromptsGetResult }
  async 'resources/list'(params: ResourcesListParams): Promise<ResourcesListResult> { return {} as ResourcesListResult }
  async 'resources/read'(params: ResourcesReadParams): Promise<ResourcesReadResult> { return {} as ResourcesReadResult }
  async "resources/subscribe"(params: ResourcesSubscribeParams): Promise<ResourcesSubscribeResult> { return {} as ResourcesSubscribeResult }
  async "resources/templates/list"(params: ResourcesTemplatesListParams): Promise<ResourcesTemplatesListResult> { return {} as ResourcesTemplatesListResult }
}

const app = new Elysia().use(
	elysiaJsonRPC<MCPServerInterface>({
		debug: true,
    service: new MCPServerService(),
    // hooks: {
    //   onVerifyId: (id: unknown): JSONRPCRequestId => {
    //     const parseResult = JSONRPCRequestIdSchema.safeParse(id);
    //     if (parseResult.success) {
    //       if (parseResult.data != null) {
    //         return parseResult.data;
    //       }
    //     }
    //     throw new MCPError();
    //   }
    // }
	})
)

const client = treaty<typeof app>(app)
const mcpClient = createClient<MCPServerInterface>(client)

describe('MCP v1 Server', () => {
  it('does not allow to use null as id', async () => {
    //
  })

	it('allows to list tools', async () => {
		const resp = (await mcpClient['tools/list']({
			cursor: ''
		} as ToolsListParams)) as ToolsListResult

		expect(resp).toBeDefined()
		expect(resp.tools).toBeArray()
		expect(resp.tools.length).toBeGreaterThan(0)

		// Check first tool structure
		const tool = resp.tools[0]
		expect(tool).toHaveProperty('name')
		expect(tool).toHaveProperty('description')
		expect(tool).toHaveProperty('inputSchema')

		// Verify specific tool exists
		const asdfTool = resp.tools.find((t) => t.name === 'asdf')
		expect(asdfTool).toBeDefined()
		expect(asdfTool?.description).toBe('A test tool')
	})

	it('allows to call tools', async () => {
		const resp = await mcpClient['tools/call']({
			name: 'asdf',
			arguments: { arg: 'test' }
		})

		expect(resp).toBeDefined()
		expect(resp.content).toBeArray()
		expect(resp.content.length).toBeGreaterThan(0)

		// Check content structure
		const content = resp.content[0]
		expect(content).toHaveProperty('type')
		expect(content).toHaveProperty('text')
		expect(content.type).toBe('text')
		expect(content.text).toContain('asdf')
		expect(content.text).toContain('test')
  })

  it('responds to initialize', async () => {
		const resp = await mcpClient.initialize({
			protocolVersion: '2025-11-25',
			capabilities: {
				sampling: {},
				elicitation: {}
			},
			clientInfo: {
				name: 'conformance-test-client',
				version: '1.0.0'
			}
		})
		expect(resp).toBeObject()
  })

	it('responds to ping', async () => {
		const resp = await mcpClient.ping({})

		expect(resp).toBeDefined()
	})

	it('throws error for non-existent tool', async () => {
		expect(async () => {
			await mcpClient['tools/call']({
				name: 'nonexistent',
				arguments: {}
			})
		}).toThrow()
	})

	it('throws error for non-existent method', async () => {
		expect(async () => {
			await (mcpClient as any)['tools/call2']({
				name: 'nonexistent',
				arguments: {}
			})
		}).toThrow()
	})

	it('validates tool parameters', async () => {
		const resp = await mcpClient['tools/call']({
			name: 'asdf',
			arguments: {
				arg: 'valid-value'
			}
		})

		expect(resp).toBeDefined()
		expect(resp.content[0].text).toContain('valid-value')
	})

	it('returns all required tool properties in tools/list', async () => {
		const resp = await mcpClient['tools/list']({})

		resp.tools.forEach((tool) => {
			expect(tool.name).toBeString()
			expect(tool.description).toBeString()
			expect(tool.inputSchema).toBeObject()
			expect(tool.inputSchema.type).toBe('object')
		})
	})

	it('handles empty params in tools/call', async () => {
		const resp = await mcpClient['tools/call']({
			name: 'asdf',
			arguments: {}
		})

		expect(resp).toBeDefined()
		expect(resp.content).toBeArray()
	})

	it('lists multiple tools', async () => {
		const resp = await mcpClient['tools/list']({})

		expect(resp.tools.length).toBeGreaterThanOrEqual(2)

		const toolNames = resp.tools.map((t: any) => t.name)
		expect(toolNames).toContain('asdf')
		expect(toolNames).toContain('echo')
	})

	it('tool call returns MCP v1 compliant response', async () => {
		const resp = await mcpClient['tools/call']({
			name: 'asdf',
			arguments: { arg: 'test-value' }
		})

		// MCP v1 tools/call should return content array
		expect(resp).toHaveProperty('content')
		expect(Array.isArray(resp.content)).toBe(true)

		// Each content item should have type and text
		resp.content.forEach((item: any) => {
			expect(item).toHaveProperty('type')
			if (item.type === 'text') {
				expect(item).toHaveProperty('text')
				expect(item.text).toBeString()
			}
		})
	})
})

/**
 * Creates a typed client for JSON-RPC calls over the treaty client
 * @param client - Treaty client instance
 * @returns Proxy object that converts method calls to JSON-RPC requests
 */
function createClient<T = MCPServer>(client: Treaty.Create<typeof app>): T {
  const accessor = async (method: string, params: JSONRPCParams = {}) => {
		// Make JSON-RPC request through the treaty client
		const request: JSONRPCRequest = {
			jsonrpc: '2.0',
			method: method,
			params: params,
			id: Math.random().toString(36).substring(7)
		}
		try {
			const response: any = await client['stream'].post(request)

			// Handle JSON-RPC error response
			if (response.error) {
				const errorData = response.error
				const errorMessage =
					typeof errorData === 'object' && 'message' in errorData
						? (errorData.message as string)
						: 'JSON-RPC Error'
				const errorCode =
					typeof errorData === 'object' && 'code' in errorData
						? errorData.code
						: JSONRPCErrorCode.InternalError

				const error = new Error(errorMessage)
				;(error as any).code = errorCode
				throw error
			} else if (response.data['error'] != undefined) {
				const error = JSONRPCErrorResponseSchema.parse(
					response.data['error']
				)
				throw new JSONRPCException(error.error.code, error.error.message)
			}

			// Return the result from successful response
			return response.data?.result
		} catch (e) {
			// console.error(`client request failed for '${method}'`)
			const zodError = e as ZodError
			if (zodError) {
				throw new Error('validation error')
			} else {
				throw e
			}
		}
	}
	return new Proxy(
		{},
		{
      get(_target, l1: string) {
        return (...args: any[]) => {
						return accessor(l1, ...args)
					}
			}
		}
	) as T
}
