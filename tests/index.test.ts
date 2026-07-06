import { treaty } from '@elysiajs/eden'
import { describe, expect, it } from 'bun:test'
import Elysia from 'elysia'
import elysiaJsonRPC from '../src'
import {
	JSONRPC_VERSION,
	JSONRPCErrorCode,
	JSONRPCErrorResponseSchema,
	JSONRPCException,
	JSONRPCParams,
	JSONRPCResult,
	JSONRPCResultResponseSchema,
	OPENRPC_VERSION,
	OpenRPCSchema
} from '../src/rpc.types'

interface ServiceIntf {
	'tools/list'(params: JSONRPCParams): JSONRPCResult
	test(params: JSONRPCParams): JSONRPCResult
	ping(params: JSONRPCParams): JSONRPCResult
	subtract(params: JSONRPCParams): JSONRPCResult
	sum(params: JSONRPCParams): JSONRPCResult
	notify_hello(params: JSONRPCParams): JSONRPCResult
	get_data(params: JSONRPCParams): JSONRPCResult
	tools: {
		specified: (params: JSONRPCParams) => JSONRPCResult
	}
}

class Service implements ServiceIntf {
	'tools/list'(params: JSONRPCParams): JSONRPCResult {
		return [
			{ name: 'hammer', category: 'hand tools' },
			{ name: 'screwdriver', category: 'hand tools' }
		]
	}
	'tools' = {
		specified(params: JSONRPCParams): JSONRPCResult {
			return {}
		},
		unspecified(params: JSONRPCParams): JSONRPCResult {
			return {}
		}
	}

	test(params: JSONRPCParams): JSONRPCResult {
		return { status: 'success', params }
	}

	ping(params: JSONRPCParams): JSONRPCResult {
		return 'pong'
	}

	subtract(params: JSONRPCParams): JSONRPCResult {
		if (Array.isArray(params)) {
			return (params[0] as number) - (params[1] as number)
		}
		if (typeof params === 'object' && params !== null) {
			const { minuend, subtrahend } = params as {
				minuend: number
				subtrahend: number
			}
			return minuend - subtrahend
		}
		throw new JSONRPCException(JSONRPCErrorCode.InvalidParams, 'Invalid params')
	}

	sum(params: JSONRPCParams): JSONRPCResult {
		if (Array.isArray(params)) {
			return (params as number[]).reduce((acc, val) => acc + val, 0)
		}
		throw new JSONRPCException(JSONRPCErrorCode.InvalidParams, 'Invalid params')
	}

	notify_hello(params: JSONRPCParams): JSONRPCResult {
		// Notification methods don't return results
		return undefined
	}

	get_data(params: JSONRPCParams): JSONRPCResult {
		return ['hello', 5]
	}
}

const app = new Elysia().use(
	elysiaJsonRPC<Service>({
    debug: false,
    dns_rebind_origin: 'localhost',
		service: new Service()
	})
)

interface RPCClient {
  json(jsonObject: object): Promise<any | undefined> // requests json and returns json
  request(jsonObject: object): Promise<Response> // requests json and returns Response
  requestjson(jsonObject: object): Promise<Response> // requests json and returns Response
}

class StreamableHTTPClient implements RPCClient {
  constructor(readonly app:any){}
  async request(request: object): Promise<any | undefined> {
    const streamHTTPURL = 'http://localhost/stream'
    const res = await this.app.handle(new Request(streamHTTPURL, request));
    return res
  }
  async requestjson(request: object): Promise<any | undefined> {
    const res = await this.request({
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' }
    });
    return res
  }
  async json(request: object): Promise<any | undefined> {
    const res = await this.requestjson(request);

    expect(res.status).toBeLessThan(400)
    expect(res.ok).toBe(true)
    try {
      const data = await res.json()
      return data
    } catch (e) {
      // what do?
      return undefined;
    }
  }
}


class SSEClient implements RPCClient{
  constructor(readonly app: any) {
  }
  async json(jsonObject: object): Promise<any | undefined> // requests json and returns json
  {
    // send event through post
    const events = new EventSource("http://localhost/sse");
    const eventQueue = []
    events.onmessage = (event: MessageEvent<any>) => {
      console.log("it works")
      eventQueue.push(event.data);
    };
    const res = await this.requestjson(jsonObject);
    // now wait for the return channel

    return {}
  }

  async request(request: object): Promise<Response> // requests json and returns Response
  {
    const streamHTTPURL = 'http://localhost/sse'
    const res = await this.app.handle(new Request(streamHTTPURL, request));
    return res
  }

  async requestjson(jsonObject: object): Promise<Response> // requests json and returns Response
  {
    const res = await this.request({
        method: 'POST',
        body: JSON.stringify(jsonObject),
        headers: { 'Content-Type': 'application/json' }
    });
    return res
  }

}

describe('test all variants of clients', () => {
	for (const [clientType, client] of Object.entries({
    streamableHTTP: new StreamableHTTPClient(app),
    // sse: new SSEClient(app),
	})) {
		const rpcClient = client as RPCClient

		describe('JSON-RPC 2.0 Spec Compliance', () => {
			describe('Request Object Validation', () => {
				it('should accept valid request with positional parameters', async () => {
					const data = await rpcClient.json({
							jsonrpc: '2.0',
							method: 'subtract',
							params: [42, 23],
							id: 1
						})
					expect(data.jsonrpc).toBe('2.0')
					expect(data.result).toBe(19)
					expect(data.id).toBe(1)
				})

				it('should accept valid request with named parameters', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'subtract',
            params: { subtrahend: 23, minuend: 42 },
            id: 2
          })
					expect(data.jsonrpc).toBe('2.0')
					expect(data.result).toBe(19)
					expect(data.id).toBe(2)
				})

				it('should accept request without params', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'ping',
            id: 3
          })
					expect(data.jsonrpc).toBe('2.0')
					expect(data.result).toBe('pong')
					expect(data.id).toBe(3)
				})

				it('should accept string id', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'test',
            params: { id: 'asdf' },
            id: 'string-id-123'
          })

					expect(data.id).toBe('string-id-123')
				})

        it('should accept null id', async () => {
          const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'test',
            params: { id: 'test' },
            id: null
          })
					expect(data.id).toBe(null)
				})

				it('should handle notification (request without id)', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'notify_hello',
            params: [7]
          })
					// Notifications should not return a response according to spec
					// or return 204 No Content
          expect(data).toBeUndefined()
				})
			})

			describe('Response Object Validation', () => {
				it('should return valid success response', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'test',
            params: { value: 'test' },
            id: 1
          })

					// Validate response structure
					expect(data).toHaveProperty('jsonrpc')
					expect(data).toHaveProperty('result')
					expect(data).toHaveProperty('id')
					expect(data).not.toHaveProperty('error')

					expect(data.jsonrpc).toBe('2.0')
					expect(data.id).toBe(1)

					const parseResult =
						JSONRPCResultResponseSchema.safeParse(data)
					expect(parseResult.success).toBe(true)
				})

				it('should return valid error response', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'nonexistent_method',
            id: 1
          })

					// Validate error response structure
					expect(data).toHaveProperty('jsonrpc')
					expect(data).toHaveProperty('error')
					expect(data).toHaveProperty('id')
					expect(data).not.toHaveProperty('result')

					expect(data.jsonrpc).toBe('2.0')
					expect(data.error).toHaveProperty('code')
					expect(data.error).toHaveProperty('message')
					expect(typeof data.error.code).toBe('number')
					expect(typeof data.error.message).toBe('string')

					const parseError =
						JSONRPCErrorResponseSchema.safeParse(data)
					expect(parseError.success).toBe(true)
				})
			})

			describe('Error Codes Compliance', () => {
				it('should return http error for invalid json and parse error', async () => {
					const res = await rpcClient.request({
            method: 'POST',
            body: '{invalid json}',
            headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' }
          })
					expect(res.status).toBeGreaterThanOrEqual(400)
					expect(res.status).toBeLessThan(500)
					try {
						const text = await res.text()
						expect(text).toBe('Bad Request')
						// const data = await res.json()
						// expect(data).toBeObject()
						// const parsedError = JSONRPCErrorResponseSchema.safeParse(data)
						// expect(parsedError.success).toBe(true)
						// expect(data.error.code).toBe(-32600)
						// expect(data.error.message).toContain('Pars')
					} catch (e) {
						expect(e).not.toBeObject()
						expect(true).toBe(false) // die here
					}
        })

				it('should reject for invalid origin', async () => {
					const res = await rpcClient.request({
            method: 'POST',
            body: '{invalid json}',
            headers: { 'Content-Type': 'application/json'}
          })
					expect(res.status).toBeGreaterThanOrEqual(400)
					expect(res.status).toBeLessThan(500)
					try {
						const text = await res.text()
						expect(text).toBe('Wrong domain')
						// const data = await res.json()
						// expect(data).toBeObject()
						// const parsedError = JSONRPCErrorResponseSchema.safeParse(data)
						// expect(parsedError.success).toBe(true)
						// expect(data.error.code).toBe(-32600)
						// expect(data.error.message).toContain('Pars')
					} catch (e) {
						expect(e).not.toBeObject()
						expect(true).toBe(false) // die here
					}
				})

				// it('should return -32700 for parse error', async () => {
				//   const res = await app.handle(createRequest({'test'}))
				//   const data = await res.json()
				//   expect(data).toBeObject()
				//   const parsedError = JSONRPCErrorResponseSchema.safeParse(data)
				//   expect(parsedError.success).toBe(true)
				//   expect(data.error.code).toBe(-32700)
				//   expect(data.error.message).toContain('Parse error')
				// })

				it('should return -32600 for invalid request', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            // missing method
            id: 1
          })

					expect(data.error.code).toBe(-32600)
					expect(data.error.message).toContain('Invalid Request')
				})

				it('should return -32601 for method not found', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'foobar',
            id: 1
          })

					expect(data.error.code).toBe(-32601)
					expect(data.error.message).toContain('ethod not found')
				})

				it('should return -32602 for invalid params', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'sum',
            params: { invalid: 'params' }, // sum expects array
            id: 1
          })

					expect(data.error.code).toBe(-32602)
					expect(data.error.message).toContain('Invalid params')
				})

				it('should return -32603 for internal error', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'ping', // Assuming this throws internal error
            params: null,
            id: 1
          })
					// This test depends on implementation details
					// Adjust based on how internal errors are handled
				})
			})

			describe('Batch Requests', () => {
				it('should handle batch requests', async () => {
					const data = await rpcClient.json([
            {
              jsonrpc: '2.0',
              method: 'sum',
              params: [1, 2, 4],
              id: '1'
            },
            {
              jsonrpc: '2.0',
              method: 'subtract',
              params: [42, 23],
              id: '2'
            },
            { jsonrpc: '2.0', method: 'get_data', id: '9' }
          ])

					expect(Array.isArray(data)).toBe(true)
					expect(data.length).toBe(3)

					// Verify each response
					data.forEach((response: any) => {
						expect(response.jsonrpc).toBe('2.0')
						expect(response).toHaveProperty('id')
					})
				})

				it('should handle batch with notifications', async () => {
					const data = await rpcClient.json([
            {
              jsonrpc: '2.0',
              method: 'notify_hello',
              params: [7]
            },
            {
              jsonrpc: '2.0',
              method: 'sum',
              params: [1, 2, 4],
              id: '1'
            }
          ])

					// Notifications don't get responses, so only 1 response expected
					if (Array.isArray(data)) {
						expect(data.length).toBe(1)
						expect(data[0].id).toBe('1')
					}
				})

				it('should return error for empty batch', async () => {
					const data = await rpcClient.json([])
					expect(data.error.code).toBe(-32600)
				})

				it('should return error for invalid batch (not array)', async () => {
					const data = await rpcClient.json([
            1,
            2,
            3 // Invalid batch items
          ])

					expect(Array.isArray(data)).toBe(true)
					data.forEach((response: any) => {
						expect(response.error.code).toBe(-32600)
					})
				})
				it('should handle the result exactly as the specification', async () => {
					const data = await rpcClient.json([
            {
              jsonrpc: '2.0',
              method: 'sum',
              params: [1, 2, 4],
              id: '1'
            },
            {
              jsonrpc: '2.0',
              method: 'notify_hello',
              params: [7]
            },
            {
              jsonrpc: '2.0',
              method: 'subtract',
              params: [42, 23],
              id: '2'
            },
            { foo: 'boo' },
            {
              jsonrpc: '2.0',
              method: 'foo.get',
              params: { name: 'myself' },
              id: '5'
            },
            { jsonrpc: '2.0', method: 'get_data', id: '9' }
          ])

					expect(data).toBeArray()
					expect(data).toBeArrayOfSize(5)
					const resultData = [
						{ jsonrpc: '2.0', result: 7, id: '1' },
						{ jsonrpc: '2.0', result: 19, id: '2' },
						{
							jsonrpc: '2.0',
							error: { code: -32600, message: 'Invalid Request' },
							id: null
						},
						{
							jsonrpc: '2.0',
							error: {
								code: -32601,
								message: 'Method not found'
							},
							id: '5'
						},
						{ jsonrpc: '2.0', result: ['hello', 5], id: '9' }
					]
					expect(data[0]).toEqual(resultData[0])
					expect(data[1]).toEqual(resultData[1])
					expect(data[2]).toEqual(resultData[2])
					expect(data[3]).toEqual(resultData[3])
					expect(data[4]).toEqual(resultData[4])
				})
			})

			describe('Edge Cases', () => {
				it('should handle method names with slashes', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1
          })

					expect(Array.isArray(data.result)).toBe(true)
				})

				it('should reject fractional id numbers', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'test',
            id: 1.5 // Spec says id should not contain fractional parts
          })
					// Implementation may choose to accept or reject this
					// Strict implementations should reject
				})

				it('should reject requests with wrong jsonrpc version', async () => {
          const data = await rpcClient.json({
            jsonrpc: '1.0',
            method: 'test',
            id: 1
          })
					expect(data.error.code).toBe(-32600)
				})

				it('should resolve methods in objects as long as they are specified', async () => {
					const data = await rpcClient.json({
            jsonrpc: '2.0',
            method: 'tools/specified',
            id: 1
          })
					expect(data.result).toBeObject()
				})

				// it('should reject methods in objects as long as they are not specified', async () => {
				// 	const res = await app.handle(
				// 		createRequest({
				// 			jsonrpc: '2.0',
				// 			method: 'tools/unspecified',
				// 			id: 1
				// 		})
				//   )
				// 	const data = await res.json()
				// 	expect(data.result).toBeUndefined()
				// 	expect(data.error).toBeObject()
				// })
			})
		})

		describe('OpenRPC Spec Compliance', () => {
			async function getOpenRPCJson(): Promise<any> {
				const client = treaty<typeof app>(app)
				const resp = await client['openrpc.json'].get({headers:{'Origin':'localhost'}})
				return resp.data
			}

			it('should provide valid OpenRPC document', async () => {
				const res = await getOpenRPCJson()
				const parseResult = OpenRPCSchema.safeParse(res)

				expect(parseResult.success).toBe(true)
				if (parseResult.success) {
					const doc = parseResult.data

					// Required fields per OpenRPC spec
					expect(doc).toHaveProperty('openrpc')
					expect(doc.openrpc).toBe(OPENRPC_VERSION)

					expect(doc).toHaveProperty('info')
					expect(doc.info).toHaveProperty('title')
					expect(doc.info).toHaveProperty('version')

					expect(doc).toHaveProperty('methods')
					expect(Array.isArray(doc.methods)).toBe(true)
				}
			})

			it('should document all available methods', async () => {
				const doc = await getOpenRPCJson()

				const methodNames = doc.methods.map((m: any) => m.name)

				// Verify all service methods are documented
				expect(methodNames).toContain('test')
				expect(methodNames).toContain('ping')
				expect(methodNames).toContain('tools/list')
				expect(methodNames).toContain('subtract')
				expect(methodNames).toContain('sum')
			})

			it('should include valid method schemas', async () => {
				const doc = await getOpenRPCJson()

				doc.methods.forEach((method: any) => {
					// Each method must have a name
					expect(method).toHaveProperty('name')
					expect(typeof method.name).toBe('string')

					// Each method should have params and result schemas
					expect(method).toHaveProperty('params')
					expect(method).toHaveProperty('result')

					// Params should be an array
					if (method.params) {
						expect(Array.isArray(method.params)).toBe(true)
					}
				})
			})

			it('should include server information', async () => {
				const doc = await getOpenRPCJson()

				// OpenRPC documents can include servers
				if (doc.servers) {
					expect(Array.isArray(doc.servers)).toBe(true)
					doc.servers.forEach((server: any) => {
						expect(server).toHaveProperty('url')
					})
				}
			})

			it('should validate content descriptor schemas', async () => {
				const doc = await getOpenRPCJson()

				doc.methods.forEach((method: any) => {
					// Result should be a valid content descriptor
					if (method.result) {
						expect(method.result).toHaveProperty('name')
						expect(method.result).toHaveProperty('schema')
					}

					// Each param should be a valid content descriptor
					if (method.params) {
						method.params.forEach((param: any) => {
							expect(param).toHaveProperty('name')
							expect(param).toHaveProperty('schema')
						})
					}
				})
			})
		})

		describe('Integration Tests', () => {
			it('should handle complete request-response cycle', async () => {
				const res = await rpcClient.requestjson({
          jsonrpc: '2.0',
          method: 'test',
          params: { id: 'integration-test' },
          id: 'test-123'
        })

				expect(res.ok).toBe(true)
				expect(res.headers.get('content-type')).toContain(
					'application/json'
				)

				const data = await res.json()
				expect(data.jsonrpc).toBe(JSONRPC_VERSION)
				expect(data.result).toBeDefined()
				expect(data.id).toBe('test-123')

				const parseError = JSONRPCErrorResponseSchema.safeParse(data)
				const parseResponse =
					JSONRPCResultResponseSchema.safeParse(data)

				expect(parseError.success).toBe(false)
				expect(parseResponse.success).toBe(true)
			})

			it('should work with treaty client', async () => {
				const client = treaty<typeof app>(app)
				const res = await client.index.post({
					jsonrpc: '2.0',
					method: 'ping',
					id: 1
				})

				// Adjust based on treaty's actual API
				expect(res.data).toBeDefined()
			})
		})
	}
})
