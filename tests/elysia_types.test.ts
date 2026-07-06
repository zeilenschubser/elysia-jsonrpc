import Elysia, { status } from "elysia";
import elysiaJsonRPC from "../src";
import { Treaty, treaty } from "@elysiajs/eden";
import { expectTypeOf } from "expect-type";

type treatyGetMethod = {
  get: (options?: any | undefined) => Promise<any>
};


const app = new Elysia()
  .use(elysiaJsonRPC({
  }))
type AppType = typeof app;

const client = treaty<AppType>(app);
type ClientType = typeof client;


expectTypeOf<ClientType>().toHaveProperty("openrpc.json");
expectTypeOf<ClientType>().toHaveProperty("sse");
expectTypeOf<ClientType>().toHaveProperty("stream");
expectTypeOf<ClientType>().not.toHaveProperty("stream2");
