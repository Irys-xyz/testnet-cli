import { JWKInterface } from "arweave/node/lib/wallet";
import fs from "node:fs/promises";
import path from "node:path";

export async function readJwk(filepath: string): Promise<JWKInterface> {
    const f = path.resolve(process.cwd(), filepath);
    const walletData = await fs.readFile(f);
    const json = JSON.parse(walletData.toString());
    return json as JWKInterface;
}

export function defaultPort(protocol: string): number {
    switch (protocol) {
        case "http:":
            return 80;
        case "https:":
            return 443;
        default:
            throw Error(`Unsupported protocol: ${protocol}`);
    }
}