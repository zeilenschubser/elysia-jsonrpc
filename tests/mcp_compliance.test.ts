import Elysia from 'elysia'
import type {
  InitializeParams,
  InitializeResult,
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

import elysiaJsonRPC from '../src'

class MCPServerService implements MCPServerInterface {
  async initialize(params: InitializeParams): Promise<InitializeResult> {
    return {
      protocolVersion: '2025-06-18',
      capabilities: {
        logging: {},
        prompts: {
          // "listChanged": true
        },
        resources: {
          // "subscribe": true,
          // "listChanged": true
        },
        tools: {
          // "listChanged": true
        }
      },
      serverInfo: {
        name: 'ExampleServer',
        title: 'Example Server Display Name',
        version: '1.0.0'
      },
      instructions: 'Optional instructions for the client'
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
    if (tool) {
      return {
        content: [
          {
            type: 'text',
            text: `Tool '${tool}' executed with params: ${JSON.stringify(toolParams)}`
          },
          {
            type: 'image',
            data: 'asdf',
            mimeType: 'png'
          }
        ]
      }
    }
    throw new Error(`Tool '${tool}' not found`)
  }
  async 'prompts/list'(params: PromptsListParams): Promise<PromptsListResult> {
    return {} as PromptsListResult
  }
  async 'prompts/get'(params: PromptsGetParams): Promise<PromptsGetResult> {
    return {} as PromptsGetResult
  }
  async 'resources/list'(
    params: ResourcesListParams
  ): Promise<ResourcesListResult> {
    return {} as ResourcesListResult
  }
  async 'resources/read'(
    params: ResourcesReadParams
  ): Promise<ResourcesReadResult> {
    return {} as ResourcesReadResult
  }
  async 'resources/subscribe'(
    params: ResourcesSubscribeParams
  ): Promise<ResourcesSubscribeResult> {
    return {} as ResourcesSubscribeResult
  }
  async 'resources/templates/list'(
    params: ResourcesTemplatesListParams
  ): Promise<ResourcesTemplatesListResult> {
    return {} as ResourcesTemplatesListResult
  }
}

new Elysia()
  .use(
    elysiaJsonRPC<MCPServerInterface>({
      debug: true,
      service: new MCPServerService()
    })
  )
  // .onRequest(async ({ request, status }) => {
  //   console.log(request.headers)
  //   console.log("requested", request.method, request.url, await request.json())
  // })
  .onAfterResponse(async ({ responseValue }) => {
    console.log('responded', responseValue)
  })
  .listen(3000)
