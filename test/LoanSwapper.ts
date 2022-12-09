import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { IUniswapV2Pair } from "../typechain-types";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("LoanSwapper", function () {

  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const LINK_ADDRESS = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const USTD_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const PROVIDER_ADDRESS = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
  const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const BORROWED_AMOUNT = ethers.utils.parseUnits("1000", "gwei"); //wETH ~ ETH, can just use parseEther and parseUnits

  async function setupContractsFixture() {
    const [wETHSender] = await ethers.getSigners();

    const loanSwapperFactory = await ethers.getContractFactory("LoanSwapper");

    const loanSwapper = await loanSwapperFactory.deploy(
      PROVIDER_ADDRESS,
      [WETH_ADDRESS, LINK_ADDRESS, USTD_ADDRESS, WETH_ADDRESS],
      UNISWAP_V2_ROUTER_ADDRESS
    );

    const lendingPool = await ethers.getContractAt("ILendingPool", await loanSwapper.LENDING_POOL());
    const weth = await ethers.getContractAt("WETH9", WETH_ADDRESS);
    const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER_ADDRESS);
    const uniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", await router.factory());

    await wETHSender.sendTransaction({
      to: WETH_ADDRESS,
      value: ethers.utils.parseEther("10")
    });

    // Transfer to swapper so that it can repay the debt in case of losses during swapping
    weth.connect(wETHSender).transfer(loanSwapper.address, ethers.utils.parseEther("10"));

    async function getPair(addr1: string, addr2: string): Promise<IUniswapV2Pair> {
      return ethers.getContractAt("IUniswapV2Pair", await uniswapV2Factory.getPair(addr1, addr2));
    }

    return {
      loanSwapper,
      lendingPool,
      weth,
      wethLinkPair: await getPair(WETH_ADDRESS, LINK_ADDRESS),
      linkUSDTPair: await getPair(LINK_ADDRESS, USTD_ADDRESS),
      usdtWethPair: await getPair(USTD_ADDRESS, WETH_ADDRESS)
    }
  }

  interface TokenMetadata {
    name: string,
    decimals: Number
  }


  function formatTokenAmount(tokenSymbol: string, tokenValue: BigNumber, decimals: Number): string {
    return `${ethers.utils.formatUnits(tokenValue, BigNumber.from(decimals))} ${tokenSymbol}`
  }

  const printTokenArg = (msg: string, tokenSymbol: string, decimals: Number) => (value: BigNumber): boolean => {
    console.log(msg, formatTokenAmount(tokenSymbol, value, decimals));
    return true;
  }

  it("Should borrow, swap and return", async function () {
    const {
      loanSwapper,
      lendingPool,
      weth,
      wethLinkPair,
      linkUSDTPair,
      usdtWethPair
    } = await loadFixture(setupContractsFixture);


    async function getSwapPrintArgs(pair: IUniswapV2Pair, last: boolean) {
      const token0 = await ethers.getContractAt("IERC20Metadata", await pair.token0()); // All test tokens have metadata
      const token0Decimals = await token0.decimals();
      const token0Symbol = await token0.symbol();

      const token1 = await ethers.getContractAt("IERC20Metadata", await pair.token1()); // All test tokens have metadata
      const token1Decimals = await token1.decimals();
      const token1Symbol = await token1.symbol();

      return [
        anyValue,
        printTokenArg("Swap\nToken 0 amount in: %s", token0Symbol, token0Decimals),
        printTokenArg("Token 1 amount in: %s", token1Symbol, token1Decimals),
        printTokenArg("Token 0 amount out: %s", token0Symbol, token0Decimals),
        printTokenArg("Token 1 amount out: %s\n", token1Symbol, token1Decimals),
        last ? loanSwapper.address : anyValue
      ]
    }

    const wethDecimals = await weth.decimals();
    console.log(
      "Swapper WETH balance before swaps: %s",
      formatTokenAmount("WETH", await weth.balanceOf(loanSwapper.address), wethDecimals)
    );
    console.log(
      "Borrowed amount: %s\n",
      formatTokenAmount("WETH", BORROWED_AMOUNT, wethDecimals)
    );

    await expect(loanSwapper.initiateBorrowAndSwap(BORROWED_AMOUNT))
      .to.emit(wethLinkPair, "Swap").withArgs(...await getSwapPrintArgs(wethLinkPair, false))
      .to.emit(linkUSDTPair, "Swap").withArgs(...await getSwapPrintArgs(linkUSDTPair, false))
      .to.emit(usdtWethPair, "Swap").withArgs(...await getSwapPrintArgs(usdtWethPair, true))
      .to.emit(lendingPool, "FlashLoan")
      .withArgs(
        loanSwapper.address,
        loanSwapper.address,
        WETH_ADDRESS,
        BORROWED_AMOUNT,
        printTokenArg("Flash loan fee: %s", "WETH", wethDecimals),
        anyValue
      )


    console.log(
      "Swapper WETH balance after swaps: %s\n",
      formatTokenAmount("WETH", await weth.balanceOf(loanSwapper.address), wethDecimals)
    );
  });

});
