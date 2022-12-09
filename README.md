# Flash loan arbitrage

## How to run
```shell
npm install
export ALCHEMY_KEY=<YOUR KEY>
npx hardhat test
```

## Test output example
```shell
$ npx hardhat test
  LoanSwapper
Swapper WETH balance before swaps: 10.0 WETH
Borrowed amount: 0.000001 WETH

Swap
Token 0 amount in: 0.0 LINK
Token 1 amount in: 0.000001 WETH
Token 0 amount out: 0.00011482270257689 LINK
Token 1 amount out: 0.0 WETH

Swap
Token 0 amount in: 0.00011482270257689 LINK
Token 1 amount in: 0.0 USDT
Token 0 amount out: 0.0 LINK
Token 1 amount out: 0.001988 USDT

Swap
Token 0 amount in: 0.0 WETH
Token 1 amount in: 0.001988 USDT
Token 0 amount out: 0.000001023548516881 WETH
Token 1 amount out: 0.0 USDT

Flash loan fee: 0.0000000009 WETH
Swapper WETH balance after swaps: 10.000000022648516881 WETH

    ✔ Should borrow, swap and return (3862ms)


  1 passing (4s)
```