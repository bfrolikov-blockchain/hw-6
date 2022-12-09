// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {FlashLoanReceiverBase} from "@aave/protocol-v2/contracts/flashloan/base/FlashLoanReceiverBase.sol";
import {ILendingPoolAddressesProvider} from "@aave/protocol-v2/contracts/interfaces/ILendingPoolAddressesProvider.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IERC20} from "./IERC20.sol";

contract LoanSwapper is FlashLoanReceiverBase {
    address[] private _swapPath;
    IUniswapV2Router02 private _router;

    constructor(
        address poolAddressesProvider,
        address[] memory swapPath,
        address router
    )
        public
        FlashLoanReceiverBase(
            ILendingPoolAddressesProvider(poolAddressesProvider)
        )
    {
        require(
            swapPath.length >= 3,
            "Swap path must contain 3 or more tokens"
        );
        require(
            swapPath[0] == swapPath[swapPath.length - 1],
            "Start and end tokens in swap path must be the same"
        );

        _swapPath = swapPath;
        _router = IUniswapV2Router02(router);
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata /*params*/
    ) external override returns (bool) {
        address thisAddress = address(this);
        require(
            assets.length == 1 && amounts.length == 1 && premiums.length == 1,
            "Must loan exactly one token"
        );
        require(
            assets[0] == _swapPath[0],
            "Must loan the first token in the swap chain"
        );
        require(
            initiator == thisAddress,
            "Initiator must be the same contract that called flashSwap"
        );

        IERC20 asset = IERC20(assets[0]);
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];
        uint256 debt = amount.add(premium);
        asset.approve(address(_router), amount);
        _router.swapExactTokensForTokens(
            amount,
            0,
            _swapPath,
            thisAddress,
            block.timestamp
        );

        require(
            asset.balanceOf(thisAddress) >= debt,
            "Must have enough tokens to repay debt"
        );

        asset.approve(address(LENDING_POOL), debt);

        return true;
    }

    function initiateBorrowAndSwap(uint256 borrowAmount) external {
        address thisAddress = address(this);

        address[] memory assets = new address[](1);
        assets[0] = _swapPath[0];

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = borrowAmount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        LENDING_POOL.flashLoan(
            thisAddress,
            assets,
            amounts,
            modes,
            thisAddress,
            "",
            0
        );
    }
}
