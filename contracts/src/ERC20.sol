// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.23;

import {ERC20} from "solady/tokens/ERC20.sol";

contract TestErc20 is ERC20 {
    constructor() {
    }

    function name() public view virtual override returns (string memory) {
        return "TEST";
    }

    function symbol() public view virtual override returns (string memory) {
        return "TEST";
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function burnForEther(uint256 amount) public virtual {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount / 1000);
    }

    function mintForEther() public payable virtual {
        uint256 amount = msg.value * 1000;
        _mint(msg.sender, amount);
    }

    function mint(
        address to,
        uint256 value
    ) public virtual {
        _mint(to, value);
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        return super.transfer(to, amount);
    }

    fallback() external payable {}
    receive() external payable {}
}
