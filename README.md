# Elysia with Bun runtime

## Example


```
import { Elysia } from "elysia";
import { cors } from '@elysia/cors'
import elysiaJsonRPC from "../dist";
import { JSONRPCHandlerArgument, JSONRPCHandlerReturnType, JSONRPCRequestId } from "../dist/rpc.types";

const app = new Elysia()
  .use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: ['Content-Type', 'mcp-session-id', 'last-event-id']
    })
  )
  .use(
    elysiaJsonRPC({
      version: "2.0",
      rpcHandler: (opts: any, request_id: JSONRPCRequestId, request: JSONRPCHandlerArgument): Promise<JSONRPCHandlerReturnType> => {
        return Promise.resolve({
          id: null,
          jsonrpc: "2.0",
          error: {
              code: 0,
              message: "not implemented",
          },
        })
      },
    }),
  )
  .listen(3000);
```
