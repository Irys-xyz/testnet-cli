#!/usr/bin/env NODE_NO_WARNINGS=1 node
// do not remove the above line!

import Arweave from "arweave";
import { Command } from "commander"
import { ArWallet, Warp, WarpNodeFactory } from "warp-contracts";
import { version } from "../package.json"
import { defaultPort, readJwk } from "./lib";
import { connect as validatorConnect } from "./validator";
import { connect as tokenConnect, /* TokenContract, TokenContractImpl */ } from "./token"
import ora, { Ora } from "ora";


export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

import { LoggerFactory } from "warp-contracts"
import axios from "axios";

LoggerFactory.INST.logLevel("fatal");
// LoggerFactory.INST.logLevel("trace", "WASM:Rust");
// LoggerFactory.INST.logLevel("trace", "WasmContractHandlerApi");


const defaultGateway = "http://arweave.testnet1.bundlr.network/"

const faucet = "https://faucet.testnet1.bundlr.network"

const program = new Command();

program.version(version);

program
    .command("join")
    .argument("<contract>", "Address of the validator contract to join")
    .option("-g --gateway <string>", "URL for the Arweave gateway to use", defaultGateway)
    .option("-w --wallet <string>", "Path to the wallet file to load and use for interactions", "./wallet.json")
    .requiredOption("-u --url <string>", "URL for the validator you want to add")
    .requiredOption("-s --stake <string>", "Number of tokens to provide as a stake")

    .action(async (contract, opts) => {
        let spinny: Ora
        try {

            const { wallet, warp, token } = await commonInit(opts)

            const validatorUrl = new URL(opts.url);

            // connect to token, assign allowance of stake to validator contract for foreign call

            const tokenConnection = await tokenConnect(warp, token, wallet);

            const connection = await validatorConnect(warp, contract, wallet);

            // get validator contract and determine minimum stake
            const validatorState = await connection.readState()
            if (BigInt(opts.stake) < BigInt(validatorState.state.minimumStake)) {
                throw new Error(`Stake ${opts.stake} is lower than the minimum required: ${validatorState.state.minimumStake}`)
            }

            spinny = ora("Approving validator contract....").start()


            await tokenConnection.approve(contract, BigInt(opts.stake))

            spinny.text = "Staking in contract..."
            await sleep(15_000)
            spinny.text = "Joining validator contract..."
            const res = await connection.join(BigInt(opts.stake), validatorUrl);
            await sleep(15_000)
            spinny.succeed("Done!")

            console.log(JSON.stringify(res));
        } catch (e) {
            if (spinny) {
                spinny.fail(`Error joining - ${e.stack ?? e.message ?? e}`)
                return;
            }
            console.log(`Error joining - ${e.stack ?? e.message ?? e}`)
        }
    })

program
    .command("transfer").description("Transfers <amount> tokens to <destination>")
    .argument("<amount>", "amount to transfer")
    .argument("<to>", "address to transfer the tokens to")
    .option("-g --gateway <string>", "URL for the Arweave gateway to use", defaultGateway)
    .option("-w --wallet <string>", "Path to the wallet file to load and use for interactions", "./wallet.json")

    .action(async (amount, to, opts) => {
        let spinny: Ora
        try {

            spinny = ora("Transferring tokens...").start()

            const { wallet, warp, token } = await commonInit(opts)

            const connection = await tokenConnect(warp, token, wallet);
            await connection.transfer(to, BigInt(amount));

            spinny.succeed("Transfer complete!")

        } catch (e) {
            if (spinny) {
                spinny.fail(`Error transferring - ${e.stack ?? e.message ?? e}`)
                return
            }
            console.log(`Error transferring - ${e.stack ?? e.message ?? e}`)

        }
    })


program
    .command("balance").description("gets the token balance of a specified address")
    .argument("<address>", "address to query")
    /* .option("-g --gateway <string>", "URL for the Arweave gateway to use", defaultGateway) */

    .action(async (address, /* opts */) => {
        let spinny: Ora
        try {
            spinny = ora("Checking balance...").start()
            const { state } = (await axios.get(`${faucet}/contract/token`)).data
            const balance = state.balances[address] ?? 0
            spinny.succeed(`Balance of address ${address} - ${balance}`)
        } catch (e) {
            if (spinny) {
                spinny.fail(`Error getting balance - ${e.stack ?? e.message ?? e}`)
                return
            }
            console.log(`Error getting balance - ${e.stack ?? e.message ?? e}`)
        }
    })

// program
//     .command("leave").description("Leaves as a validator")
//     .argument("<contract>", "Address of the validator contract to join")
//     .option("-g --gateway <string>", "URL for the Arweave gateway to use", defaultGateway)
//     .option("-w --wallet <string>", "Path to the wallet file to load and use for interactions", "./wallet.json")
//     .action(async (contract, opts) => {
//         let spinny: Ora
//         try {

//             spinny = ora("Checking leave status...").start()

//             const { wallet, warp, token } = await commonInit(opts)
//             const connection = await validatorConnect(warp, contract, wallet)

//             // const connection = await tokenConnect(warp, token, wallet);
//             // await connection.transfer(to, BigInt(amount));
//             const currentValidators = (await connection.epoch())


//             spinny.succeed("Transfer complete!")

//         } catch (e) {
//             if (spinny) {
//                 spinny.fail(`Error transferring - ${e.stack ?? e.message ?? e}`)
//                 return
//             }
//             console.log(`Error transferring - ${e.stack ?? e.message ?? e}`)

//         }
//     })





async function commonInit(args): Promise<{ wallet: ArWallet | null, warp: Warp, arweave: Arweave, token: string, bundler: string }> {

    const arweaveUrl = new URL(args.gateway);

    const wallet = args.wallet ? await readJwk(args.wallet) : null

    const arweave: Arweave = Arweave.init({
        host: arweaveUrl.hostname,
        port: arweaveUrl.port ? arweaveUrl.port : defaultPort(arweaveUrl.protocol),
        protocol: arweaveUrl.protocol.split(":")[0], // URL holds colon at the end of the protocol
    });
    const { token, bundler } = await (await axios.get(faucet)).data

    const warp = WarpNodeFactory.memCachedBased(arweave).useArweaveGateway().build();
    return { wallet, warp, arweave, token, bundler }
}

const argv = process.argv

// console.log(JSON.stringify(argv))

program.parse(argv);
