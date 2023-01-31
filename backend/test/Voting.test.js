const { assert, expect } = require("chai")
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit Tests for the Alyra's Voting project (official correction smart contract)", function () {

        let votingInstance;

        let accounts;

        let deployer;
        let bob;
        let alice;
        let johnny;
        let pamela;

        before(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0]; //deployer == owner as per openzeppelin Constructor for Ownable
            bob = accounts[1];
            alice = accounts[2];
            johnny = accounts[3];
            pamela = accounts[4];
        });


        //===> CHECKS IF THE CONTRACTS DEPLOY WELL :
        describe("Voting smart contract deployment...", function() {
            it("Should deploy the smart contract", async function() {
                await deployments.fixture(["voting"]);
                votingInstance = await ethers.getContract("Voting");
            });

        // CHECKS IF DEPLOYER IS THE OWNER
            it("Should register deployer as contract owner", async () => {
                let contractOwner = await votingInstance.owner();
                assert.equal(deployer.address, contractOwner)
            })
        });

        //===> REGISTRATION STAGE
        describe("Registering stage... WORKFLOWSTATUS 0", function() {
            beforeEach(async() => {
                await deployments.fixture(["voting"]);
                votingInstance = await ethers.getContract("Voting");
                await votingInstance.addVoter(deployer.address);
            })

            // CHECKS IF ONLY OWNER CAN ADD VOTERS
            it("Should not be able to add a voter if user is not the owner", async () => {
                await expect(votingInstance.connect(bob).addVoter(alice.address)).to.be.revertedWith("Ownable: caller is not the owner");
            });

            // CHECKS VOTER REGISTRED EVENT + CHECKS YOU CANNOT ADD THE SAME USER TWICE
            it("Should trigger the VoterRegistered event", async () => {
                await expect(votingInstance.addVoter(alice.address)).to.emit(votingInstance, "VoterRegistered");
                await expect(votingInstance.addVoter(alice.address)).to.be.revertedWith("Already registered");
            })

            //CHECKS YOU CANNOT ADD THE SAME USER TWICE
            it("Should not be able to register same user twice", async () => {
                await expect(votingInstance.addVoter(alice.address));
                await expect(votingInstance.addVoter(alice.address)).to.be.revertedWith("Already registered");
            })

            // CHECKS A VOTER CAN SEE ANOTHER VOTER PROFILE
            it("Should returns true from bool isRegistered", async () => {
                await votingInstance.addVoter(johnny.address);
                let voter = await votingInstance.connect(johnny).getVoter(johnny.address);
                assert.equal(voter.isRegistered, true);
            });

            // CHECKS A NON-VOTER CANNOT SEE ANOTHER VOTER PROFILE
            it("Should revert as caller is not a voter", async () => {
                let voter = await expect(votingInstance.connect(pamela).getVoter(johnny.address)).to.be.revertedWith("You're not a voter");
            });

            // CHECKS IF USER CANNOT START OR END NON AVAILABLE EVENTS IN WORKFLOW STATUS OR USE UNAVAILABLE FUNCTIONS
            it("Should revert as the current workflow is the RegisteringVoters one and the next one is the ProposalsRegistrationStarted one", async () => {
                await expect(votingInstance.addProposal("Hello World ?")).to.be.revertedWith("Proposals are not allowed yet");
                await expect(votingInstance.setVote(2)).to.be.revertedWith("Voting session havent started yet");
                await expect(votingInstance.tallyVotes()).to.be.revertedWith("Current status is not voting session ended");
                await expect(votingInstance.endVotingSession()).to.be.revertedWith("Voting session havent started yet");
                await expect(votingInstance.endProposalsRegistering()).to.be.revertedWith("Registering proposals havent started yet");
                await expect(votingInstance.startVotingSession()).to.be.revertedWith("Registering proposals phase is not finished");
            });
            
        });

        //===> PROPOSAL STAGE
        describe("Proposal registration stage... WORKFLOWSTATUS 1", function() {
            beforeEach(async() => {
                await deployments.fixture(["voting"]);
                votingInstance = await ethers.getContract("Voting");
                await votingInstance.addVoter(deployer.address);
            })

            // CHECKS IF WORKFLOW STATUS CHANGE IS EMITTED
            it("Should emit the Workflow status switch from 0 to 1", async () => {
                await expect(await votingInstance.startProposalsRegistering()).to.emit(votingInstance,"WorkflowStatusChange");
            });

            // CHECKS IF OWNER
            it("Should be owner to start this stage", async () => {
                await expect(votingInstance.connect(alice).startProposalsRegistering()).to.be.revertedWith("Ownable: caller is not the owner");
            });

            // CHECKS IF PROPOSAL STAGE STARTS WELL
            it("Should have only one proposal equals to GENESIS", async () => {
                await votingInstance.startProposalsRegistering();
                let prop = await votingInstance.getOneProposal(0)
                assert(prop.description == "GENESIS")
            });

            // CHECKS IF USER CANNOT START OR END NON AVAILABLE EVENTS IN WORKFLOW STATUS OR USE UNAVAILABLE FUNCTIONS
            it("Should revert as the current workflow is the ProposalsRegistrationStarted one and the next one is the ProposalsRegistrationEnded one", async () => {
                await expect(votingInstance.addProposal("Hello World ?")).to.be.revertedWith("Proposals are not allowed yet");
                await expect(votingInstance.setVote(2)).to.be.revertedWith("Voting session havent started yet");
                await expect(votingInstance.tallyVotes()).to.be.revertedWith("Current status is not voting session ended");
                await expect(votingInstance.endVotingSession()).to.be.revertedWith("Voting session havent started yet");
                await expect(votingInstance.startVotingSession()).to.be.revertedWith("Registering proposals phase is not finished");

            });

            // CHECKS IF WE CAN MAKE A PROPOSAL
             it("Should be able to do a proposal", async () => {
                await votingInstance.startProposalsRegistering();
                await votingInstance.addProposal("Paris");
                let prop = await votingInstance.getOneProposal(1);
                assert(prop.description == "Paris");
            });
            
            // CHECKS IF WE CANNOT MAKE A PROPOSAL IF NOT REGISTRED
            it("Should NOT be able to do a proposal", async () => {
                await votingInstance.startProposalsRegistering();
                await expect(votingInstance.connect(johnny).addProposal("Rock n roll")).to.be.revertedWith(`You're not a voter`);
            });

            // CHECKS IF WE CAN SEE A FRESHLY ADDED PROPOSAL
            it("Should be able to see a posted proposal", async () => {
                await votingInstance.startProposalsRegistering();
                await votingInstance.addProposal("Rio");
                await votingInstance.addProposal("Tokyo");
                let prop = await votingInstance.getOneProposal(2);
                assert(prop.description === "Tokyo");
            });

             // CHECKS IF WE CANNOT REGISTER A VOTER NOW
             it("Should not be able to register a voter", async () => {
                await votingInstance.startProposalsRegistering();
                await expect(votingInstance.addVoter(alice.address)).to.be.revertedWith("Voters registration is not open yet");
            });

             // CHECKS IF WORKFLOW STATUS CHANGE IS EMITTED
             it("Should emit the Workflow status switch from 1 to 2", async () => {
                await votingInstance.startProposalsRegistering();
                await expect(await votingInstance.endProposalsRegistering()).to.emit(votingInstance, "WorkflowStatusChange");
             });

              
        });

        //===> VOTING STAGE
        describe("Voting stage... WORKFLOWSTATUS 2 - 3", function() {
            beforeEach(async() => {
                await deployments.fixture(["voting"]);
                votingInstance = await ethers.getContract("Voting");
                await votingInstance.addVoter(deployer.address);
                await votingInstance.addVoter(bob.address);
                await votingInstance.addVoter(alice.address);
                await votingInstance.addVoter(pamela.address);
                await votingInstance.startProposalsRegistering();
                await votingInstance.addProposal("Berlin");
                await votingInstance.connect(bob).addProposal("Marseille");
                await votingInstance.connect(alice).addProposal("Denver");
                await votingInstance.connect(pamela).addProposal("Madrid");
                await votingInstance.endProposalsRegistering();
            })

            // CHECKS IF OWNER TO OPEN VOTING STAGE
            it("Should be owner to open voting stage", async () => {
                await expect(votingInstance.connect(alice).startVotingSession()).to.be.revertedWith("Ownable: caller is not the owner");
            });
            
            // CHECKS IF THE PROPOSAL COUNT IS INCREMENTED AFTER ANOTHER VOTE
            it("Should increment vote counts after some votes", async () => {
                await votingInstance.startVotingSession();
                await votingInstance.setVote(3);
                await votingInstance.connect(bob).setVote(3);
                let vote = await votingInstance.getOneProposal(3);
                assert(vote.voteCount == 2);
            });

             // CHECKS IF USER CAN VOTE AND SEE PROPOSAL INDEX
           it("Should set the votedProposalId at the same index the user voted for", async () => {
            await votingInstance.startVotingSession();
            await votingInstance.setVote(3);
            let voter = await votingInstance.getVoter(deployer.address);
            assert(voter.votedProposalId == 3);
           });

            // CHECKS IF THE EVENT HAS VOTED IS EMITTED
            it("Should emit the voted event", async () => {
                await votingInstance.startVotingSession();
                await expect(await votingInstance.setVote(2)).to.emit(votingInstance, "Voted");
            });

            // CHECKS IF A VOTER CANNOT VOTE > 1 TIME
            it("Should vote only once", async () => {
                await votingInstance.startVotingSession();
                await votingInstance.setVote(2);
                let voter = await votingInstance.getVoter(deployer.address);
                assert(voter.hasVoted === true);
                await expect(votingInstance.setVote(1)).to.be.revertedWith("You have already voted");
            });

            // CHECKS IF USER IS REGISTRED
            it("Should be registred to vote", async () => {
                await votingInstance.startVotingSession();
                await expect(votingInstance.connect(johnny).setVote(1)).to.be.revertedWith(`You're not a voter`);
            });

            // CHECKS IF USER VOTES FOR A REAL PROPOSITION
            it("Should be an existing proposition", async () => {
                await votingInstance.startVotingSession();
                await expect(votingInstance.setVote(157)).to.be.revertedWith(`Proposal not found`);
            });

            // CHECKS IF WORKFLOW STATUS CHANGE IS EMITTED
            it("Should emit the Workflow status switch from 2 to 3", async () => {
                await votingInstance.startVotingSession();
                await expect(await votingInstance.endVotingSession()).to.emit(votingInstance, "WorkflowStatusChange");
             });


        });

        //===> END VOTING SESSION STAGE
        describe("END of Voting stage... WORKFLOWSTATUS 3 - 4 - 5", function() {
            beforeEach(async() => {
                await deployments.fixture(["voting"]);
                voting = await ethers.getContract("Voting");
                await votingInstance.addVoter(deployer.address);
                await votingInstance.addVoter(bob.address);
                await votingInstance.addVoter(alice.address);
                await votingInstance.addVoter(pamela.address);
                await votingInstance.startProposalsRegistering();
                await votingInstance.addProposal("Berlin");
                await votingInstance.connect(bob).addProposal("Marseille");
                await votingInstance.connect(alice).addProposal("Denver");
                await votingInstance.connect(pamela).addProposal("Madrid");
                await votingInstance.endProposalsRegistering();
                await votingInstance.startVotingSession();
                await votingInstance.setVote(3);
                await votingInstance.connect(bob).setVote(3);
                await votingInstance.connect(alice).setVote(2);
                await votingInstance.connect(pamela).setVote(1);
                await votingInstance.endVotingSession();
            })

            // CHECKS IF VOTE SESSION IS WELL CLOSED
            it("Should emit a status change when closing votes session", async () => {
                await expect(await votingInstance.tallyVotes()).to.emit(votingInstance, "WorkflowStatusChange");
            });


            // CHECKS IF THE WINNING PROPOSAL ID IS RETURNED
            it("Should return the right winning proposal ID", async () => {
                await votingInstance.tallyVotes();
                let winner = await votingInstance.winningProposalID();
                assert(winner >= 1);
             });
            
             // CHECKS IF OWNER
             it("Should be owner to close the voting session", async () => {
                await expect(votingInstance.connect(pamela).tallyVotes()).to.be.revertedWith("Ownable: caller is not the owner");
             });

            // CHECKS IF UNABLE TO VOTE AFTER COUNTING VOTES
            it("Should be unable to vote at this point", async () => {
                await votingInstance.tallyVotes();
                await expect(votingInstance.setVote(2)).to.be.revertedWith("Voting session havent started yet");
             });

            // CHECKS IF USER CAN SEE SOMEONE'S VOTE
            it("Should be able to see someone's vote", async () => {
                let voter = await votingInstance.getVoter(alice.address);
                assert(voter.votedProposalId == 2);
            });

             // CHECKS IF UNABLE TO VOTE AFTER REGISTERING VOTES
             it("Should be unable to vote at this point", async () => {
                await expect(votingInstance.setVote(1)).to.be.revertedWith("Voting session havent started yet");
             });

        });

 });