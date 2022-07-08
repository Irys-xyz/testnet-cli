#!/usr/bin/env node
// do not remove the above line!

import Arweave from "arweave";
import { Command } from "commander"
import { ArWallet, Warp, WarpNodeFactory } from "warp-contracts";
import { version } from "../package.json"
import { defaultPort, readJwk } from "./lib";
import { connect as validatorConnect } from "./validator";
import { connect as tokenConnect, TokenContract, TokenContractImpl } from "./token"


// import { LoggerFactory } from "warp-contracts"
// LoggerFactory.INST.logLevel("error");
// LoggerFactory.INST.logLevel("trace", "WASM:Rust");
// LoggerFactory.INST.logLevel("trace", "WasmContractHandlerApi");

export const defaults = {
    tokenContract: "JV1AViSVEi8VEshP5sEyv_TZWVw8Ye8oGjIxuIvARbA",
    bundlerContract: "8P1rfHRwkNVhX0kw_SLnoaq3wWtvlhB8DSJG2qzdj0E"
}

const program = new Command();

program.version(version);

program
    .command("join")
    .argument("<contract>", "Address of the validator contract to join")
    .option("-g --gateway <string>", "URL for the Arweave gateway to use", "http://arweave.net")
    .option("-w --wallet <string>", "Path to the wallet file to load and use for interactions", "./wallet.json")
    .requiredOption("-u --url <string>", "URL for the validator you want to add")
    .requiredOption("-s --stake <string>", "Number of tokens to provide as a stake")

    .action(async (contract, opts) => {
        try {

            const { wallet, warp } = await commonInit(opts)

            const validatorUrl = new URL(opts.url);

            // connect to token, assign allowance of stake to validator contract for foreign call

            const tokenConnection = await tokenConnect(warp, defaults.tokenContract, wallet);


            const connection = await validatorConnect(warp, contract, wallet);

            // get validator contract and determine minimum stake
            const validatorState = await connection.readState()
            if (BigInt(opts.stake) < BigInt(validatorState.state.minimumStake)) {
                throw new Error(`Stake ${opts.stake} is lower than the minimum required: ${validatorState.state.minimumStake}`)
            }

            await tokenConnection.approve(contract, BigInt(opts.stake))

            // join

            const res = await connection.join(BigInt(opts.stake), validatorUrl);

            console.log(res);
        } catch (e) {
            console.log(`Error joining - ${e.stack ?? e.message ?? e}`)
        }
    })

program
    .command("transfer").description("Transfers <amount> tokens to <destination>")
    .argument("<amount>", "amount to transfer")
    .argument("<to>", "address to transfer the tokens to")
    .option("-g --gateway <string>", "URL for the Arweave gateway to use", "http://arweave.net")
    .option("-w --wallet <string>", "Path to the wallet file to load and use for interactions", "./wallet.json")

    .action(async (amount, to, opts) => {
        try {
            console.log({ amount, to })
            const { wallet, warp } = await commonInit(opts)

            const connection = await tokenConnect(warp, defaults.tokenContract, wallet);
            const res = await connection.transfer(to, BigInt(amount));

            console.log(res);

        } catch (e) {
            console.log(`Error joining - ${e.stack ?? e.message ?? e}`)
        }
    })


program
    .command("balance").description("gets the token balance of a specified address")
    .argument("<address>", "address to query")
    .option("-g --gateway <string>", "URL for the Arweave gateway to use", "http://arweave.net")

    .action(async (address, opts) => {
        try {
            const { warp } = await commonInit(opts)

            const contract = new TokenContractImpl(
                defaults.tokenContract,
                warp,
                warp.useWarpGwInfo
            ).setEvaluationOptions({
                internalWrites: true,
            }) as TokenContract;

            const balance = (await contract.balanceOf(address)).balance
            console.log(`Balance of address ${address} - ${balance.toString()}`)

        } catch (e) {
            console.log(`Error getting balance - ${e.stack ?? e.message ?? e}`)
        }
    })


async function commonInit(args): Promise<{ wallet: ArWallet | null, warp: Warp, arweave: Arweave }> {

    const arweaveUrl = new URL(args.gateway);

    const wallet = args.wallet ? await readJwk(args.wallet) : null

    const arweave: Arweave = Arweave.init({
        host: arweaveUrl.hostname,
        port: arweaveUrl.port ? arweaveUrl.port : defaultPort(arweaveUrl.protocol),
        protocol: arweaveUrl.protocol.split(":")[0], // URL holds colon at the end of the protocol
    });

    const warp = WarpNodeFactory.memCached(arweave);
    return { wallet, warp, arweave }
}

const argv = process.argv

program.parse(argv);