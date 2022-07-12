import { ArWallet, Contract, HandlerBasedContract, Warp } from "warp-contracts";

export type State = {
    bundlers: { [key: string]: string | null };
    token: string;
    stake: string;
    withdrawDelay: number;
};

export interface BundlersContract extends Contract<State> {
    currentState(): Promise<State>;
    bundlers(): Promise<{ [key: string]: string }>;
    allowedInteractors(): Promise<Set<string>>;
    withdrawDelay(): Promise<number>;
    stake(): Promise<bigint>;
    token(): Promise<string>;
    join(): Promise<string | null>;
    leave(): Promise<string | null>;
    withdraw(): Promise<string | null>;
    syncSlash(): Promise<string | null>;
    addAllowedInteractor(address: string): Promise<string | null>;
    removeAllowedInteractor(address: string): Promise<string | null>;
}

class BundlersContractImpl
    extends HandlerBasedContract<State>
    implements BundlersContract {
    constructor(_contractTxId: string, warp: Warp, private _mainnet: boolean = false) {
        super(_contractTxId, warp);
    }

    async currentState(): Promise<State> {
        return (await super.readState()).state as State;
    }

    async token(): Promise<string> {
        const interactionResult = await this.viewState({
            function: "token",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as string;
    }

    async stake(): Promise<bigint> {
        const interactionResult = await this.viewState({
            function: "stake",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return BigInt(interactionResult.result as string);
    }

    async bundlers(): Promise<{ [key: string]: string }> {
        const interactionResult = await this.viewState({
            function: "bundlers",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as { [key: string]: string };
    }

    async allowedInteractors(): Promise<Set<string>> {
        const interactionResult = await this.viewState({
            function: "allowedInteractors",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as Set<string>;
    }

    async withdrawDelay(): Promise<number> {
        const interactionResult = await this.viewState({
            function: "withdrawDelay",
        });
        if (interactionResult.type !== "ok") {
            throw Error(interactionResult.errorMessage);
        }
        return interactionResult.result as number;
    }

    async join(): Promise<string | null> {
        return this.write({
            function: "join",
        });
    }

    async leave(): Promise<string | null> {
        return this.write({
            function: "leave",
        });
    }

    async withdraw(): Promise<string | null> {
        return this.write({
            function: "withdraw",
        });
    }

    async syncSlash(): Promise<string | null> {
        return this.write({
            function: "syncSlash",
        });
    }

    async addAllowedInteractor(address: string): Promise<string | null> {
        return this.write({
            function: "addAllowedInteractor",
            interactor: address,
        });
    }

    async removeAllowedInteractor(address: string): Promise<string | null> {
        return this.write({
            function: "removeAllowedInteractor",
            interactor: address,
        });
    }

    async write(input: any,): Promise<string | null> {

        const dwRes = await this.dryWrite(input)
        if (dwRes.type !== "ok") {
            throw new Error("Simulated contract interaction failed!")
        }
        return this._mainnet ? this.bundleInteraction(input).then(r => r.originalTxId) : this.writeInteraction(input);
    }
}

// export async function deploy(
//     warp: Warp,
//     wallet: ArWallet,
//     initialState: State,
//     useBundler: boolean = false,
// ): Promise<string> {
//     let contractSrc = fs.readFileSync(
//         path.join(__dirname, "../pkg/rust-contract_bg.wasm")
//     );
//     // deploying contract using the new SDK.
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
): Promise<BundlersContract> {
    const contract = new BundlersContractImpl(
        contractTxId,
        warp,
        warp.useWarpGwInfo // We assume that if we're using the Warp gateway then we're on mainnet
    ).setEvaluationOptions({
        internalWrites: true,
    }) as BundlersContract;

    return contract.connect(wallet) as BundlersContract;
}
