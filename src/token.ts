
import { ArWallet, Contract, HandlerBasedContract, Warp } from "warp-contracts";

export type TokenState = {
    ticker: string;
    name: string | null | unknown;
    decimals: number;
    totalSupply: string;
    owner: string;
    balances: {
        [key: string]: string;
    };
    allowances: {
        [key: string]: {
            [key: string]: string;
        };
    };
};

export class Balance {
    balance: bigint;
    target: string;
    ticker: string;

    constructor({
        balance,
        ticker,
        target,
    }: {
        balance: string;
        ticker: string;
        target: string;
    }) {
        this.balance = BigInt(balance);
        this.ticker = ticker;
        this.target = target;
    }
}

export class Allowance {
    allowance: bigint;
    ticker: string;
    owner: string;
    spender: string;

    constructor({
        allowance,
        ticker,
        owner,
        spender,
    }: {
        allowance: string;
        ticker: string;
        owner: string;
        spender: string;
    }) {
        this.allowance = BigInt(allowance);
        this.ticker = ticker;
        this.owner = owner;
        this.spender = spender;
    }
}

export interface TokenContract extends Contract<TokenState> {
    allowance(owner: string, spender: string): Promise<Allowance>;
    balanceOf(target: string): Promise<Balance>;
    currentState(): Promise<TokenState>;
    decimals(): Promise<number>;
    name(): Promise<string | null | unknown>;
    symbol(): Promise<string>;
    totalSupply(): Promise<bigint>;

    approve(spender: string, value: bigint): Promise<string | null>;
    burn(amount: bigint): Promise<string | null>;
    burnFrom(from: string, amount: bigint): Promise<string | null>;
    transfer(to: string, value: bigint): Promise<string | null>;
    transferFrom(from: string, to: string, value: bigint): Promise<string | null>;
}

export class TokenContractImpl
    extends HandlerBasedContract<TokenState>
    implements TokenContract {
    constructor(_contractTxId: string, warp: Warp, private _mainnet: boolean = false) {
        super(_contractTxId, warp);
    }

    async currentState(): Promise<TokenState> {
        return (await super.readState()).state;
    }

    async name(): Promise<string> {
        const interactionResult = await this.viewState({
            function: "name",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as string;
    }

    async symbol(): Promise<string> {
        const interactionResult = await this.viewState({
            function: "symbol",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as string;
    }

    async decimals(): Promise<number> {
        const interactionResult = await this.viewState({
            function: "decimals",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as number;
    }

    async totalSupply(): Promise<bigint> {
        const interactionResult = await this.viewState({
            function: "totalSupply",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return BigInt(interactionResult.result as string);
    }

    async balanceOf(target: string): Promise<Balance> {
        const interactionResult = await this.viewState({
            function: "balanceOf",
            target,
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return new Balance(
            interactionResult.result as {
                ticker: string;
                target: string;
                balance: string;
            }
        );
    }

    async burn(amount: bigint): Promise<string | null> {
        return await this.write({
            function: "burn",
            amount: amount.toString(),
        });
    }

    async burnFrom(from: string, amount: BigInt): Promise<string | null> {
        return await this.write({
            function: "burnFrom",
            from,
            amount: amount.toString(),
        });
    }

    async transfer(to: string, value: bigint): Promise<string | null> {
        return await this.write({
            function: "transfer",
            to,
            amount: value.toString(),
        });
    }

    async transferFrom(from: string, to: string, value: BigInt): Promise<string | null> {
        return await this.write({
            function: "transferFrom",
            from,
            to,
            amount: value.toString(),
        });
    }

    async approve(spender: string, value: BigInt): Promise<string | null> {
        return await this.write({
            function: "approve",
            spender,
            amount: value.toString(),
        });
    }

    async allowance(owner: string, spender: string): Promise<Allowance> {
        const interactionResult = await this.viewState({
            function: "allowance",
            owner,
            spender,
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return new Allowance(
            interactionResult.result as {
                allowance: string;
                ticker: string;
                owner: string;
                spender: string;
            }
        );
    }

    async write(input: any): Promise<string | null> {
        const dwRes = await this.dryWrite(input)
        if (dwRes.type !== "ok") {
            throw new Error(`Simulated contract interaction failed! - ${dwRes.errorMessage}`)
        }
        const res = this._mainnet ? await this.bundleInteraction(input).then(r => r.originalTxId) : await this.writeInteraction(input);
        if (!res) {
            throw new Error("Unable to post interaction")
        }
        return res
    }
}

// export function deploy(
//     warp: Warp,
//     wallet: ArWallet,
//     initialState: TokenState,
//     useBundler = false
// ): Promise<string> {
//     const contractSrc = fs.readFileSync(
//         path.join(__dirname, "../pkg/rust-contract_bg.wasm")
//     );

//     return warp.createContract.deploy({
//         wallet,
//         initState: JSON.stringify(initialState),
//         src: contractSrc,
//         wasmSrcCodeDir: path.join(__dirname, "../src"),
//         wasmGlueCode: path.join(__dirname, "../pkg/rust-contract.js"),
//     }, useBundler);
// }

export async function connect(
    warp: Warp,
    contractTxId: string,
    wallet: ArWallet
): Promise<TokenContract> {
    const contract = new TokenContractImpl(
        contractTxId,
        warp,
        warp.useWarpGwInfo // We assume that if we're using the Warp gateway then we're on mainnet
    ).setEvaluationOptions({
        internalWrites: true,
    }) as TokenContract;

    return contract.connect(wallet) as TokenContract;
}
