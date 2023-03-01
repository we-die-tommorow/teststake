var walletAddress = null,
    stakingContract = null,
    contract = null,
    stakingAddress = "0x39199E1271Cdb354956158c3533a50eCcdD7662E",
    contractAddress = "0x7a2DAd6736b8Eb8629f1851f6153dB957E64B42c",
    isMetaMask = true,
    web3 = null,
    web3Modal = null,
    provider = null,
    errorTimer = null,
    isApproved = false,
    isEmergency = false;

var Web3Modal = window.Web3Modal.default;
var WalletConnectProvider = window.WalletConnectProvider.default;
var Fortmatic = window.Fortmatic;
var evmChains = window.evmChains;

$(document).ready(function () {
    $('.connectBtn').on('click', function () {
        if (walletAddress === null) {
            $("#walletConnectModal").css("display", "block");
        }
        else {
            if (confirm("Would you like to disconnect from this dApp?")) {
                if (isMetaMask) {
                    metaMaskConnect.disconnect();
                }
                else {
                    walletConnect.disconnect();
                }
            }
        }
    });

    $("#modalWConnect").on("click", function () {
        walletConnect.initialise();
        walletConnect.connect();
        $("#walletConnectModal").css("display", "none");
    });

    $("#modalMMConnect").on("click", function () {
        metaMaskConnect.initialise().then(function () {
            metaMaskConnect.connect();
        });
        $("#walletConnectModal").css("display", "none");
    });

    $("#walletConnectModal").css("display", "block");
});

function initialiseContracts() {
    stakingContract = new web3.eth.Contract(getStakingABI(), stakingAddress);
    contract = new web3.eth.Contract(getContractABI(), contractAddress);

    getUserInfo().then(function (info) {
        var tokenAmount = info.amount / 10 ** 18;
        var pendingRewards = info.pendingRewards / 10 ** 18;
        var balanceUser = info.balanceOf / 10 ** 18;
        var totalStaked = info.totalStaked / 10 ** 18;
        var nextWithdrawl = new Date(info.unlockTime * 1000);

        if (info.unlockTime > 0) {
            $("#unlockLb").html(nextWithdrawl.toLocaleString());
        }

        $("#rewardsLb").html(pendingRewards.toFixed(2));
        $("#stakedLb").html(tokenAmount.toFixed(2));
        $(".balance").html(balanceUser.toFixed(2));
        $(".totalStaked").html(addCommas(totalStaked.toFixed(2)));
        $(".apyEst").html(info.apy + "%");
        $("#tokenAmtTb").val(balanceUser.toFixed(2));

        if (Date.parse(nextWithdrawl) > Date.parse(new Date())) {
            $(".withdrawTokensBtn").addClass('emergency');
            $(".withdrawTokensBtn").html('Emergency Withdraw');
            isEmergency = true;
        }
        else {
            $(".withdrawTokensBtn").removeClass('emergency');
            $(".withdrawTokensBtn").html('Withdraw Tokens');
            isEmergency = false;
        }

        // Button Events

        $(".withdrawTokensBtn").on("click", function () {
            if (Date.parse(nextWithdrawl) > Date.parse(new Date())) {
                if (confirm("Are you sure you wish to emergency withdraw your tokens? You will be taxed 10%. Proceed with caution")) {
                    withdrawLoader.showLoader();

                    stakingContract.methods.emergencyWithdraw()
                        .send({ from: walletAddress })
                        .then(function (res, err) {
                            if (res.status) {
                                setAlert(false, "Successfully emergency withdrawn 10% taxed tokens");

                                getUserInfo().then(function (info) {
                                    var tokenAmount = info.amount / 10 ** 18;
                                    var balanceUser = info.balanceOf / 10 ** 18;
                                    $("#stakedLb").html(tokenAmount.toFixed(2));
                                    $(".balance").html(balanceUser.toFixed(2));
                                });
                            }
                            else {
                                setAlert(true, "Could not emergency withdraw your tokens at this time, please try again later");
                            }
                            withdrawLoader.hideLoader();
                        })
                        .catch(function (err) {
                            setAlert(true, "Error: " + err.message);
                            withdrawLoader.hideLoader();
                        });
                }
            }
            else {
                if (tokenAmount > 0) {
                    withdrawLoader.showLoader();

                    stakingContract.methods.withdraw()
                        .send({ from: walletAddress })
                        .then(function (res, err) {
                            if (res.status) {
                                setAlert(false, "Successfully withdrawn " + tokenAmount + " tokens");

                                getUserInfo().then(function (info) {
                                    var tokenAmount = info.amount / 10 ** 18;
                                    var balanceUser = info.balanceOf / 10 ** 18;
                                    $("#stakedLb").html(tokenAmount.toFixed(2));
                                    $(".balance").html(balanceUser.toFixed(2));
                                });
                            }
                            else {
                                setAlert(true, "Could not withdraw your tokens at this time, please try again later");
                            }
                            withdrawLoader.hideLoader();
                        })
                        .catch(function (err) {
                            setAlert(true, "Error: " + err.message);
                            withdrawLoader.hideLoader();
                        });
                }
                else {
                    setAlert(true, "You do not have anything to withdraw");
                }
            }
        });

        $(".harvestRewardsBtn").on("click", function () {
            if (pendingRewards > 0) {
                harvestedLoader.showLoader();

                stakingContract.methods.deposit('0')
                    .send({ from: walletAddress })
                    .then(function (res, err) {
                        if (res.status) {
                            setAlert(false, "Successfully claimed harvested " + pendingRewards + " tokens");

                            getUserInfo().then(function (info) {
                                var pendingRewards = info.pendingRewards / 10 ** 18;
                                var balanceUser = info.balanceOf / 10 ** 18;
                                $("#rewardsLb").html(pendingRewards.toFixed(2));
                                $(".balance").html(balanceUser.toFixed(2));
                            });
                        }
                        else {
                            setAlert(true, "Could not claim your harvested rewards at this time, please try again later");
                        }
                        harvestedLoader.hideLoader();
                    })
                    .catch(function (err) {
                        setAlert(true, "Error: " + err.message);
                        harvestedLoader.hideLoader();
                    });
            }
            else {
                setAlert(true, "You do not have enough token rewards to harvest");
            }
        });

        contract.methods.allowance(walletAddress, stakingAddress)
            .call()
            .then(function (res, err) {
                //console.log("User approved for: " + res);

                if (parseInt(res) >= 100000000000000000000) {
                    isApproved = true;
                    $(".stakeBtn").html('Stake Now');
                }
                else {
                    isApproved = false;
                    $(".stakeBtn").html('Approve');
                }

                $(".stakeBtn").on("click", function () {
                    // Deduct 1 token because they won't be a 'holder' anymore
                    var tokenAmt = parseFloat($("#tokenAmtTb").val() - 1);

                    if (tokenAmt < 1) {
                        tokenAmt = 1;
                    }

                    if (isApproved) {
                        stakeLoader.showLoader();
                        let correctAmount = parseInt(tokenAmt.toString()) * 10 ** 18
                        stakingContract.methods.deposit(correctAmount.toString())
                            .send({ from: walletAddress })
                            .then(function (res, err) {
                                if (res.status) {
                                    setAlert(false, "Successfully deposited " + tokenAmt + " tokens");
                                    $("#tokenAmtTb").val('');

                                    getUserInfo().then(function (info) {
                                        var tokenAmount = info.amount / 10 ** 18;
                                        var balanceUser = info.balanceOf / 10 ** 18;
                                        $("#stakedLb").html(tokenAmount.toFixed(2));
                                        $(".balance").html(balanceUser.toFixed(2));
                                    });
                                }
                                else {
                                    setAlert(true, "Could not stake your tokens at this time, please try again later");
                                }
                                stakeLoader.hideLoader();
                            })
                            .catch(function (err) {
                                setAlert(true, "Error: " + err.message);
                                stakeLoader.hideLoader();
                            });
                    }
                    else {
                        stakeLoader.showLoader();

                        contract.methods.approve(stakingAddress, '115792089237316195423570985008687907853269984665640564039457584007913129639935')
                            .send({ from: walletAddress })
                            .then(function (res, err) {
                                if (res.status) {
                                    setAlert(false, "Successfully approved the contract");
                                    $(".stakeBtn").html('Stake Now');
                                    isApproved = true;
                                }
                                else {
                                    setAlert(true, "Could not approve the contract at this time, please try again later");
                                    isApproved = false;
                                }
                                stakeLoader.hideLoader();
                            })
                            .catch(function (err) {
                                setAlert(true, "Error: " + err.message);
                                stakeLoader.hideLoader();
                            });
                    }
                });
            },
                function (err) {
                    console.log(err.message);
                });
    },
        function (err) {
            console.log("Error: " + err.message);
        });
}

function sortAPY(val) {
    var spl = val.toString().split(".");
    return parseFloat(spl[1][0] + spl[1][1] + "." + spl[1][2]);
}

function addCommas(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}

function setAlert(error, msg) {
    clearInterval(errorTimer);
    $(".alert").remove();

    var elem = '';

    if (error) {
        elem = '<div class="alert danger"><span class="closebtn">&times;</span><i class="fa fa-times-circle"></i>&nbsp;&nbsp;&nbsp;' + msg + '</div>';
    }
    else {
        elem = '<div class="alert success"><span class="closebtn">&times;</span><i class="fa fa-check-circle"></i>&nbsp;&nbsp;&nbsp;' + msg + '</div>';
    }

    var alertElem = $(elem).hide();

    $('body').prepend(alertElem);
    $(".alert").slideDown();

    $(".closebtn").on("click", function () {
        $(".alert").fadeOut();
    });

    window.parent.scrollTo({ top: 0, behavior: 'smooth' });

    errorTimer = setInterval(function () {
        clearInterval(errorTimer);
        $(".alert").fadeOut();
    }, 6000);
}

function getUserInfo() {
    return new Promise(function (resolve, reject) {

        var userInfo = new Promise(function (resolve, reject) {
            stakingContract.methods.userInfo(walletAddress)
                .call(function (err, res) {
                    if (res) {
                        resolve(res);
                    }
                    else {
                        reject(err);
                    }
                });
        });

        var pendingReward = userInfo.then(function (result) {
            return new Promise(function (resolve, reject) {
                stakingContract.methods.pendingReward(walletAddress)
                    .call(function (err, res) {
                        if (res) {
                            resolve(res);
                        }
                        else {
                            reject(err);
                        }
                    });
            });
        });

        var balanceOf = pendingReward.then(function (result) {
            return new Promise(function (resolve, reject) {
                contract.methods.balanceOf(walletAddress)
                    .call(function (err, res) {
                        if (res) {
                            resolve(res);
                        }
                        else {
                            reject(err);
                        }
                    });
            });
        });

        var totalStaked = balanceOf.then(function (result) {
            return new Promise(function (resolve, reject) {
                stakingContract.methods.totalStaked()
                    .call(function (err, res) {
                        if (res) {
                            resolve(res);
                        }
                        else {
                            reject(err);
                        }
                    });
            });
        });

        var apy = totalStaked.then(function (result) {
            return new Promise(function (resolve, reject) {
                stakingContract.methods.apy()
                    .call(function (err, res) {
                        if (res) {
                            resolve(res);
                        }
                        else {
                            reject(err);
                        }
                    });
            });
        });

        var unlockTime = apy.then(function (result) {
            return new Promise(function (resolve, reject) {
                stakingContract.methods.holderUnlockTime(walletAddress)
                    .call(function (err, res) {
                        if (res) {
                            resolve(res);
                        }
                        else {
                            reject(err);
                        }
                    });
            });
        });

        Promise.all([userInfo, pendingReward, balanceOf, totalStaked, apy, unlockTime])
            .then(function (values) {
                resolve({
                    'nextWithdrawal': values[0].nextWithdraw,
                    'amount': values[0].amount,
                    'pendingRewards': values[1],
                    'balanceOf': values[2],
                    'totalStaked': values[3],
                    'apy': values[4],
                    'unlockTime': values[5]
                });
            });
    });
}

var walletConnect = {
    initialise: function() {
        if (location.protocol !== 'https:') {
            alert("You cannot connect your wallet unsecurely. Please revist the website using HTTPS.");
            return;
        }
        
        var providerOptions = {
            walletconnect: {
                package: WalletConnectProvider,
                options: {
                  infuraId: "8c8fc252553c49fea9537f9d8c412933",
                  rpc: {
                 //   2001: "https://explorer-mainnet-cardano-evm.c1.milkomeda.com",
                 //   2001: "https://rpc-devnet-cardano-evm.c1.milkomeda.com",
                  //56: "https://bsc-dataseed.binance.org/",
                 // 97: "https://data-seed-prebsc-1-s1.binance.org:8545/"
                    1: "https://mainnet.infura.io/v3/"

                  },
                  network: "ETH"
                }
            },
            fortmatic: {
                package: Fortmatic,
                options: {
                  key: "pk_test_391E26A3B43A3350"
                }
            }
        };

        web3Modal = new Web3Modal({
            cacheProvider: false,
            providerOptions: providerOptions,
            disableInjectedProvider: false,
            theme: "dark"
        });
    },
    connect: function () {
        try {
            web3Modal.connect().then(function (_provider) {
                provider = _provider;

                provider.on("accountsChanged", function (accounts) {
                    walletConnect.fetchAccountData();
                });

                provider.on("chainChanged", function (chainId) {
                    walletConnect.fetchAccountData();
                });

                provider.on("networkChanged", function (networkId) {
                    walletConnect.fetchAccountData();
                });

                walletConnect.fetchAccountData();
            });
        }
        catch (e) {
            console.log("Could not get a wallet connection", e);
            return;
        }
    },
    disconnect: function () {
        if (provider.close) {
            provider.close().then(function () {
                web3Modal.clearCachedProvider().then(function () {
                    provider = null;
                });
            });
        }
        web3 = null;
        walletAddress = null;

        walletConnect.updateUI();
    },
    fetchAccountData: function () {
        return new Promise(function (resolve, reject) {
            web3 = new Web3(provider);

            web3.eth.getAccounts().then(function (accounts) {
                walletAddress = accounts[0];
                walletConnect.updateUI();
                resolve(true);
            },
                function (err) {
                    resolve(err.message);
                });
        });
    },
    updateUI: function () {
        if (web3) {
            isMetaMask = false;
            initialiseContracts();
            $(".connectBtn").html('Connected: ' + shorten(walletAddress));
        }
        else {
            $(".connectBtn").html('Connect Wallet');
        }
    }
};

var metaMaskConnect = {
    initialise: function () {
        return new Promise(function (resolve, reject) {
            window.ethereum.enable().then(function () {
                window.ethereum.on('accountsChanged', function (accounts) {
                    metaMaskConnect.connect();
                });

                resolve(true);
            },
                function (err) {
                    resolve(false);
                });
        });
    },
    connect: function () {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            metaMaskConnect.updateUI();
        }
        else if (window.web3) {
            window.web3 = new Web3(web3.currentProvider);
            web3 = new Web3(web3.currentProvider);
            metaMaskConnect.updateUI();
        }
        else {
            alert('Error! No Metamask Detected!');
        }
    },
    disconnect: function () {
        window.web3 = null;
        web3 = null;
        walletAddress = null;
        metaMaskConnect.updateUI();
    },
    updateUI: function () {
        if (window.web3) {
            walletAddress = window.web3.currentProvider.selectedAddress;

            if (!walletAddress) {
                walletAddress = window.web3.currentProvider.address;
            }

            isMetaMask = true;
            initialiseContracts();

            $(".connectBtn").html('Connected: ' + shorten(walletAddress));
        }
        else {
            $(".connectBtn").html('Connect Wallet');
        }
    },
};

var harvestedLoader = {
    showLoader: function () {
        $(".harvestRewardsBtn").html('<i class="fa fa-spinner fa-spin"></i> Claiming...');
    },
    hideLoader: function () {
        $(".harvestRewardsBtn").html('Claim Rewards');
    }
};

var withdrawLoader = {
    showLoader: function () {
        $(".withdrawTokensBtn").html('<i class="fa fa-spinner fa-spin"></i> Withdrawing...');
    },
    hideLoader: function () {
        if (isEmergency) {
            $(".withdrawTokensBtn").html('Emergency Withdraw');
        }
        else {
            $(".withdrawTokensBtn").html('Withdraw Tokens');
        }
    }
};

var stakeLoader = {
    showLoader: function () {
        if (isApproved) {
            $(".stakeBtn").html('<i class="fa fa-spinner fa-spin"></i> Staking...');
        }
        else {
            $(".stakeBtn").html('<i class="fa fa-spinner fa-spin"></i> Approving...');
        }
    },
    hideLoader: function () {
        if (isApproved) {
            $(".stakeBtn").html('Stake Now');
        }
        else {
            $(".stakeBtn").html('Approve');
        }
    }
};

window.onclick = function (event) {
    var modal = document.getElementById("walletConnectModal");

    if (event.target == modal) {
        $("#walletConnectModal").css("display", "none");
    }
}

document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
}, false);

document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.keyCode == 123) {
        e.stopPropagation();
        e.preventDefault();
    }
});

function shorten(address) {
    return address[0] + address[1] + address[2] + address[3] + "..." + address[address.length - 4] + address[address.length - 3] + address[address.length - 2] + address[address.length - 1];
}

function getContractABI() {
    return [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"bool","name":"isExcluded","type":"bool"}],"name":"ExcludeFromFees","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"pair","type":"address"},{"indexed":true,"internalType":"bool","name":"value","type":"bool"}],"name":"SetAutomatedMarketMakerPair","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"tokensSwapped","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ethReceived","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"tokensIntoLiquidity","type":"uint256"}],"name":"SwapAndLiquify","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DeveloperJoeyop","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"_isExcludedMaxTransactionAmount","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"automatedMarketMakerPairs","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"buyLiquidityFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"buyMarketingFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"buyTotalFees","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"devWallet","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"enableTrading","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"bool","name":"excluded","type":"bool"}],"name":"excludeFromFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"updAds","type":"address"},{"internalType":"bool","name":"isEx","type":"bool"}],"name":"excludeFromMaxTransaction","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isExcludedFromFees","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"limitsInEffect","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxTransactionAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxWallet","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"removeLimits","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"sellLiquidityFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"sellMarketingFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"sellTotalFees","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"pair","type":"address"},{"internalType":"bool","name":"value","type":"bool"}],"name":"setAutomatedMarketMakerPair","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"swapEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"swapTokensAtAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tokensForLiquidity","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tokensForMarketing","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tradingActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"uniswapV2Pair","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"uniswapV2Router","outputs":[{"internalType":"contract IUniswapV2Router02","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_buyLiquidityFee","type":"uint256"},{"internalType":"uint256","name":"_buyMarketingFee","type":"uint256"},{"internalType":"uint256","name":"_sellLiquidityFee","type":"uint256"},{"internalType":"uint256","name":"_sellMarketingFee","type":"uint256"}],"name":"updateFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"updateSwapEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newAmount","type":"uint256"}],"name":"updateSwapTokensAtAmount","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]

}

function getStakingABI() {
    return [{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Deposit", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "EmergencyWithdraw", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Withdraw", "type": "event" }, { "inputs": [], "name": "apy", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "calculateNewRewards", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "deposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "emergencyRewardWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "emergencyWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "exitPenaltyPerc", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "holderUnlockTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "lockDuration", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "massUpdatePools", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "pendingReward", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "poolInfo", "outputs": [{ "internalType": "contract IBEP20", "name": "lpToken", "type": "address" }, { "internalType": "uint256", "name": "allocPoint", "type": "uint256" }, { "internalType": "uint256", "name": "lastRewardTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "accTokensPerShare", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "rewardToken", "outputs": [{ "internalType": "contract IBEP20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "rewardsRemaining", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "stakingToken", "outputs": [{ "internalType": "contract IBEP20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "startReward", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "stopReward", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "totalStaked", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "newApy", "type": "uint256" }], "name": "updateApy", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "newPenaltyPerc", "type": "uint256" }], "name": "updateExitPenalty", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "newlockDuration", "type": "uint256" }], "name": "updatelockduration", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "userInfo", "outputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "rewardDebt", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }];
}

