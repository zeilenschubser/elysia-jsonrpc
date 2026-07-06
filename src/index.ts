import Elysia, {
  ElysiaCustomStatusResponse,
  InvertedStatusMap,
  sse,
  StatusMap
} from 'elysia'
import z from 'zod'
import {
  JSONRPC_VERSION,
  JSONRPCErrorCode,
  JSONRPCException,
  JSONRPCNotificationSchema,
  JSONRPCParamsSchema,
  JSONRPCRequestSchema,
  JSONRPCSupportedVersionsSchema,
  OPENRPC_VERSION,
  type JSONRPCErrorResponse,
  type JSONRPCHandlerArgument,
  type JSONRPCHandlerReturnType,
  type JSONRPCNotification,
  type JSONRPCParams,
  type JSONRPCRequest,
  type JSONRPCRequestId,
  type JSONRPCResult,
  type JSONRPCSupportedVersions,
  type OpenRPCMethodObject
} from './rpc.types'
export { type InitializeParams, type MCPError } from './mcp.types'

export type JSONRPCProcedure = (
  params: JSONRPCParams
) => Promise<JSONRPCResult> | JSONRPCResult
export type JSONRPCHandlerFunction<T> = (
  opts: T,
  request_id: JSONRPCRequestId,
  request: JSONRPCHandlerArgument
) => Promise<JSONRPCHandlerReturnType>

export type OnErrorEventHandler = (res: JSONRPCErrorResponse) => void
export type OnRequestEventHandler = (
  res: JSONRPCRequest | JSONRPCNotification
) => void
export type OnResponseEventHandler = (
  res: JSONRPCHandlerReturnType | undefined
) => void

export interface PluginOptions<T> {
  dns_rebind_origin?: string
  version: JSONRPCSupportedVersions
  title?: string
  rpcHandler: JSONRPCHandlerFunction<T>
  cors: string
  debug: boolean
  service: T
  onError?: OnErrorEventHandler
  onResponse?: OnResponseEventHandler
  onRequest?: OnRequestEventHandler
}

export interface UserPluginOptions<T> extends Partial<PluginOptions<T>> {}

export const DEFAULT_OPTIONS: PluginOptions<any> = {
  version: JSONRPC_VERSION,
  debug: false,
  dns_rebind_origin: undefined,
  rpcHandler: defaultJSONRPCHandler,
  onError: undefined,
  onResponse: undefined,
  onRequest: undefined,
  service: null,
  cors: '*'
}

export interface ServiceInterface {
  [name: string]: JSONRPCProcedure
}

/**
 * throws possibly JSONRPCException
 */
export async function defaultJSONRPCHandler<T extends ServiceInterface>(
  service: T,
  request_id: JSONRPCRequestId,
  request: JSONRPCHandlerArgument
): Promise<JSONRPCHandlerReturnType> {
  const method = getMethod(service, request.method)
  const params: JSONRPCParams = getParams(request.params)
  const result: JSONRPCResult = await method.apply(service, [params])
  return {
    id: request_id,
    jsonrpc: '2.0',
    result
  }
}

function getMethod<T extends ServiceInterface>(
  service: T,
  methodName: string
): JSONRPCProcedure {
  if (!service) {
    throw new JSONRPCException(
      JSONRPCErrorCode.MethodNotFound,
      'Invalid Method'
    )
  }
  const method = service[methodName]
  if (!method) {
    const methodParts = methodName.split('/')
    if (methodParts.length > 1) {
      return getMethod(
        service[methodParts[0]] as unknown as T,
        methodParts.slice(1).join('/')
      )
    }
    throw new JSONRPCException(
      JSONRPCErrorCode.MethodNotFound,
      'Method not found'
    )
  }
  return method
}

function assertJSONRPCVersion(version: string): boolean {
  const versionParsed = JSONRPCSupportedVersionsSchema.safeParse(version)
  if (!versionParsed.success)
    throw new JSONRPCException(
      JSONRPCErrorCode.InvalidRequest,
      'Invalid JSON RPC Version'
    )
  return versionParsed.success
}

function getParams(
  params: Record<any, unknown> | unknown[] | undefined
): JSONRPCParams {
  const result = JSONRPCParamsSchema.safeParse(params)
  if (!result.success)
    throw new JSONRPCException(JSONRPCErrorCode.InvalidParams, 'Invalid Params')
  return result.data
}

function parseJSON(body: any): object {
  try {
    const parsedBody = typeof body === 'string' ? JSON.parse(body) : body
    if (typeof body == 'object') {
      return parsedBody
    }
    throw new JSONRPCException(
      JSONRPCErrorCode.ParseError,
      'body is not an object'
    )
  } catch (e) {
    throw new JSONRPCException(
      JSONRPCErrorCode.ParseError,
      'failed json parse',
      e as Error
    )
  }
}

function jsonRPCErrorResponseFromError(
  request_id: JSONRPCRequestId,
  error?: JSONRPCException,
  debug: boolean = false
): JSONRPCErrorResponse {
  return {
    id: request_id,
    jsonrpc: '2.0',
    error: {
      code: error?.code || JSONRPCErrorCode.InvalidRequest,
      message: error?.message || 'InvalidRequest',
      data: debug && error ? (error.originalError ?? {}) : undefined
    }
  }
}

export { InvertedStatusMap, StatusMap }
export type supportedStatusCodes = keyof InvertedStatusMap
export type supportedStatusMessages = keyof StatusMap
export type StatusCodes = <
  const Code extends number | supportedStatusMessages,
  const CustomReturnCode = Code extends supportedStatusCodes
    ? InvertedStatusMap[Code]
    : Code
>(
  code: Code,
  response?: CustomReturnCode
) => ElysiaCustomStatusResponse<
  Code,
  CustomReturnCode,
  Code extends supportedStatusMessages ? StatusMap[Code] : Code
>

export default function elysiaJsonRPC<
  T extends unknown extends ServiceInterface ? T : unknown
>(userOptions: UserPluginOptions<T>) {
  const opts: PluginOptions<T> = {
    ...(DEFAULT_OPTIONS as unknown as PluginOptions<T>),
    ...userOptions
  }
  const handleRequest = async function (
    parsedBody: object
  ): Promise<JSONRPCHandlerReturnType | undefined> {
    let id: JSONRPCRequestId = null
    try {
      const rpcRequest: z.ZodSafeParseResult<JSONRPCRequest> =
        JSONRPCRequestSchema.safeParse(parsedBody)
      const rpcNotification: z.ZodSafeParseResult<JSONRPCNotification> =
        JSONRPCNotificationSchema.safeParse(parsedBody || {})

      if (rpcRequest.success) {
        assertJSONRPCVersion(rpcRequest.data.jsonrpc)
        id = rpcRequest.data?.id
        try {
          if (opts.onRequest) opts.onRequest(rpcRequest.data)
        } catch (e) {}
        const ret = await opts.rpcHandler(opts.service, id, rpcRequest.data)
        return ret
      } else if (rpcNotification.success) {
        assertJSONRPCVersion(rpcNotification.data.jsonrpc)
        try {
          if (opts.onRequest) opts.onRequest(rpcNotification.data)
        } catch (e) {}
        // throw Error('rpcNotification not implemented yet')
      } else {
        throw new JSONRPCException(
          JSONRPCErrorCode.InvalidRequest,
          'Invalid Request',
          rpcRequest.error
        )
      }
    } catch (e) {
      const err = jsonRPCErrorResponseFromError(
        id,
        e as JSONRPCException,
        opts.debug
      )
      try {
        if (opts.onError) opts.onError(err)
      } catch (e2) {}
      return err
    }
  }

  // DeepReplace: walks a type and replaces the value at a key path
  type DeepReplace<T, Path extends string[], Replacement> =
    Path extends [infer Head extends string, ...infer Rest extends string[]]
      ? {
          [K in keyof T]: K extends Head
            ? Rest extends []
              ? Replacement
              : DeepReplace<T[K], Rest, Replacement>
            : T[K]
        }
    : Replacement;
  function replaceType<Path extends string[], Replacement>() {
    return function<T>(value: T): DeepReplace<T, Path, Replacement> {
      return value as any;
    }
  }

  const routeHandlerFunction = async function ({
    body,
    set
  }: {
    body: any
    set: any
  }) {
    set.headers['Content-Type'] = 'application/json'
    try {
      const parsedBody: object = parseJSON(body)
      if (Array.isArray(parsedBody)) {
        // batch mode
        let res = []
        if (parsedBody.length == 0) {
          throw new JSONRPCException(
            JSONRPCErrorCode.InvalidRequest,
            'Batch empty'
          )
        }
        for (const request of parsedBody) {
          const ret = await handleRequest(request)
          try {
            if (ret && opts.onResponse) opts.onResponse(ret)
          } catch (e) {}
          if (ret) res.push(ret)
        }
        return res
      } else {
        const ret = await handleRequest(parsedBody)
        try {
          if (ret && opts.onResponse) opts.onResponse(ret)
        } catch (e) {}
        return ret
      }
    } catch (e) {
      const err: JSONRPCErrorResponse = jsonRPCErrorResponseFromError(
        null,
        e as JSONRPCException,
        opts.debug
      )
      try {
        if (opts.onError) opts.onError(err)
      } catch (e) {}
      return err
    }
  }
  const serverSentEvents = new Elysia()
    .options("sse", async ({ set }) => {
      set.headers['Allow'] = ['GET', 'POST', 'OPTIONS'].join(',')
    })
    .get("sse", async function* ({ set }) {
      set.headers['Content-Type'] = 'text/event-stream'
      // TODO: handle
      for await (const data of []) {
        yield sse({ data, event: 'message' })
      }
      yield sse({ event: 'done' })
    })
    .post("sse", ({ body }) => {})
  const streamableHTTP = new Elysia()
    .options("stream", async ({ set, status }) => {
      set.headers['Allow'] = ['POST', 'OPTIONS'].join(',')
    })
    .post("stream", routeHandlerFunction, {
      // body: JSONRPCMessageSchema
    })
  const openRPC = new Elysia().get('/openrpc.json', async ({}) => {
    const prototype = Object.getPrototypeOf(opts.service)
    const methods = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== 'constructor' &&
        typeof (opts.service as any)[name] === 'function'
    )
    return {
      openrpc: OPENRPC_VERSION,
      info: {
        title: opts.title || 'JSON RPC Server',
        version: opts.version
      },
      methods: methods.map((name) => {
        return {
          name,
          params: [],
          result: {
            name: '',
            schema: ''
          }
        } as OpenRPCMethodObject
      })
    }
  })
  const plugin = new Elysia({ name: 'jsonRPC' }).onRequest(
    ({ request, status }) => {
      if (opts.dns_rebind_origin !== undefined) { // if not give, just dont do it
        const origin = request.headers.get('Origin')
        if (origin != opts.dns_rebind_origin) {
          return status(400, 'Wrong domain')
        }
      }
    }
  )

  const ret = plugin.use(serverSentEvents).use(streamableHTTP).use(openRPC)
  return ret
}

