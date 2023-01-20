# Declarative Deployments

- [Introduction](#introduction)
- [Model a single contract instance](#model-a-single-contract-instance)
- [Contract instance linked to a library](#contract-instance-linked-to-a-library)
- [Contract instance with constructor arguments](#contract-instance-with-constructor-arguments)
- [Contract instance with constructor arguments whose values come from the migration process](#contract-instance-with-constructor-arguments-whose-values-come-from-the-migration-process)
  - [Should certain constructs automatically capture info?](#should-certain-constructs-automatically-capture-info-)
- [Reference contracts from NPM/etc. packages](#reference-contracts-from-npm-etc-packages)
- [Handle the lifecycle of a transaction](#handle-the-lifecycle-of-a-transaction)
- [Separate any imperative code that we cannot abstract into the solver](#separate-any-imperative-code-that-we-cannot-abstract-into-the-solver)
- [Handle scripts that need to be executed during the deployment process](##handle-scripts-that-need-to-be-executed-during-the-deployment-process)
- [Handle environmental differences](#handle-environmental-differences)
  - [Use a state identifier that contains potentially multiple network identifiers](#use-a-state-identifier-that-contains-potentially-multiple-network-identifiers)
  - [Add a network identifier to each contract that will be deployed](#add-a-network-identifier-to-each-contract-that-will-be-deployed)
- [Prepare deployment information for easy debugging](#prepare-deployment-information-for-easy-debugging)
- [Support truffle preserve functionality](#support-truffle-preserve-functionality)
- [Capture data for frontend use](#capture-data-for-frontend-use)
- [Implement/provide a signing mechanism](#implement-provide-a-signing-mechanism)
- [Support for relay transactions](#support-for-relay-transactions)
- [Support existing Truffle migration flags, like --reset, --f, --to](#support-existing-truffle-migration-flags--like---reset----f----to)
- [Gas price optimization](#gas-price-optimization)
- [Handle upgradeable contracts](#handle-upgradeable-contracts)
- [Control flow -- ensure solver has knowledge of partial state](#control-flow----ensure-solver-has-knowledge-of-partial-state)
- [For reference, the goals HardHat Ignition seeks to achieve](#for-reference--the-goals-hardhat-ignition-seeks-to-achieve)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

## Introduction

This repository is the place for us to collaborate on putting together a canonical yaml template for use in declarative deployments.

How to model deployed contracts is ultumately the main question. The concerns below are basically all related to it. Trying to answer the fundamental question of "what do my deployed contracts look like in their final state" to provide the declaration that our "solver" will work with to properly run a deployment.

With that in mind, the following are the main concerns that we need to account for, with example implementations where possible (taken from the notes here: https://hackmd.io/JpRUpkfASguJkl4N5kBcbA):

## Model a single contract instance

```yaml
- contract: SafeMathLib
```

## Contract instance linked to a library

```yaml
- contract: SafeSendLib
- contract: Escrow
  links: SafeSendLib
```

## Contract instance with constructor arguments

```yaml
- contract: HumanStandardToken
  arguments:
    - totalSupply: 1_000_000 # positional? named?
```

## Contract instance with constructor arguments whose values come from the migration process

We have agreed that this is likely best represented through the use of capture variables, the way that Artillery does it; an example looks something like this:

```yaml
- SafeMathLib:
      arguments:
        - SafeMathLib
      # capture the address of this contract when it is deployed
      # is the capture flow sufficient for getting what we need here? this should make the captured variable available everywhere else in the file
      capture:
        - address: "$.address"
          as: "address"
          # can also optionally transform the captured variable;
          # wouldn't do toString() here, just an example
          # gnidan would prefer we not have this be an option, leaving it here for discussion
          transform: "this.address.toString()"
          # can capture multiple variables
        - transactionHash: "$.transactionHash"
          as: "transactionHash"
          # stop execution and error if we don't get the variable
          # setting loose to true would mean we continue without it
          loose: false
    - HumanStandardToken:
      # only execute this deployment if we have the previous deployment address
      ifTrue: address
      arguments:
        - HumanStandardToken
        # this is contrived, but idea is to pass address of previous
        # deployed contract to this one
        - SafeMathLibAddress: "{{ address }}"
```

### Should certain constructs automatically capture info?

For instance, perhaps every contract that is deployed has its deployment address captured? What other info might we want to capture automatically?

## Reference contracts from NPM/etc. packages

This probably needs more consideration, but one option is to have a list of required packages in the yaml itself, and then our solver can require those packages.

```yaml
require: ["dotenv", "@truffle/hdwallet-provider"]
```

## Handle the lifecycle of a transaction

Is this a role for the `yaml` file? How might we capture data from events in a useful way? The capture syntax above would probably be sufficient, we should just identify the data that we want to capture.

## Separate any imperative code that we cannot abstract into the solver

One way to do this is to refer to a file that contains a script for doing this, like so:

```yaml
  - contract: SumDAO
      links: SafeMathLib
      using:
        - execution: ./populate-data.js
```

## Handle scripts that need to be executed during the deployment process

Scripts may need processing at any point during the deployment flow, and our schema for how they are handled should reflect the needed
flexibility. Here is an example covering some basic scripting needs:

```yaml
# open questions:
# how do we handle passing arguments? do we disallow that in the first iteration?
# add | once option? (Svelte)

ethereum:
  - contract: MyContract
  - contract: MyOtherContract
    links: MyContract

  # runs once before the given contract is deployed
  - process:
    path: <SCRIPT_PATH>
    before: MyContract

  # runs before multiple contracts are deployed
  - process:
    path: <SCRIPT_PATH>
    before:
      - MyContract
      - MyOtherContract

  # runs after MyContract but before MyOtherContract
  - process:
    path: <SCRIPT_PATH>
    before: MyOtherContract
    after: MyContract

  # runs after each listed contract
  - process:
    path: <SCRIPT_PATH>
    afterEach:
      - MyContract
      - MyOtherContract

  # runs before any contract is deployed in this network
  - process:
    path: <SCRIPT_PATH>
    before: all # scoped to this network

  # runs before all contracts no matter what network
  - process:
    path: <SCRIPT_PATH>
    before: allGlobal

```
## Handle environmental differences

There are a two (or more!) potentially suitable options to address this concern:

### Use a state identifier that contains potentially multiple network identifiers

```yaml
deployed:
  ethereum: # network identifier within an environment
    - contract: SumDAO
      links: SafeMathLib

    - contract: SafeMathLib

    - execution: ./populate-data.js

  arbitrum:
    -  # ...
```

### Add a network identifier to each contract that will be deployed

This network identifier would need to match a network in the configuration file. One benefit of doing it this way is flexibility -- maybe the dev wants to deploy one contract to ethereum, then two to arbitrum, and then another to ethereum. Grouping the declaration by contract rather than network, it is easier to visualize that flow.

```yaml
- SafeMathLib:
    arguments:
      - SafeMathLib
    network: ethereum_local
```

## Prepare deployment information for easy debugging

Should we indicate within the `yaml` file what variables/breakpoints/etc we want to capture for debugging? The debugger has its own complex flow but perhaps there is some synergy here for building dev tooling to make particular aspects accessible in new ways!

## Support truffle preserve functionality

Seems like we need the url if we are saving the data in a folder, and we need the sourcePath to the data that will be saved there. We should probably also capture the hash we get back.

_Question: what if we want to save several items? Initial thought is to make this a list but we should think through the best way to structure it!_

```yaml
preserve:
  url: "..."
  sourcePath: "..."
  capture:
    cid: "$.cid"
    as: "cid"
    loose: false
```

## Capture data for frontend use

We may want developers to indicate what data they want returned for frontend use. This could be as simple as a list of what we want returned. The tricky part is how to indicate which contract instance or deployment step the data is coming from. This could be an extension of the capture functionality -- automatically return all variables that are captured. Or add a return field to captured variables, allowing the developer to decide _exactly_ what data they want. This could then be saved to a file outside the traditional artifacts, for frontend use.

_Open question -- this was one of the use cases for Truffle DB, so perhaps there is a different flow that could be better that incorporates DB (I guess this is a question for the solver? Here we just need to indicate what we want returned, right?)._

```yaml
capture:
  cid: ".$cid"
  as: "cid"
  loose: false
  return: true
```

## Implement/provide a signing mechanism

## Support for relay transactions

## Support existing Truffle migration flags, like --reset, --f, --to

## Gas price optimization

## Handle upgradeable contracts

## Control flow -- ensure solver has knowledge of partial state

Truffle should know where things are at a point of failure so you can resume from there. Shouldn't have to start from scratch. This seems like an issue for the solver, but are there things we can add to the yaml to make it easier?

## For reference, the goals HardHat Ignition seeks to achieve

Obviously our work is separate, but it is good to keep in mind that they do have the benefit
of user feedback and we should at least consider these concerns as a guide in our work:

1. Managing multiple deployment environments with different setups
2. Automated retry and resume mechanisms
3. Automated gas cost optimization
4. Transaction batching and parallelization
5. Tracking of deployed addresses
6. Automation of contract initialization procedures
