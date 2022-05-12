import assert from "assert";
import "dotenv/config";
import { isSupportedChainId } from "./utils";
import { fetchRoutes } from "./tokenRoutes";
import fs from "fs";
const [chainId, hubPoolAddress] = process.argv.slice(2);
assert(isSupportedChainId(Number(chainId)), "Requires supported chainid");
// assert(hubPoolAddress,'Requires hubPoolAddress')
fetchRoutes(Number(chainId), hubPoolAddress).then((result) => {
  const filename =
    ["routes", result.hubPoolChain, result.hubPoolAddress].join("_") + ".json";
  fs.writeFileSync(filename, JSON.stringify(result, null, 2));
});
