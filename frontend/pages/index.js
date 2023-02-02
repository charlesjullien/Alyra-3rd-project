import { useState, useEffect } from 'react'
import Contract from "../../backend/artifacts/contracts/Voting.sol/Voting"
import { Votes } from '../components/Votes'
import { Flex, Text, Input, Button, useToast, Alert, AlertIcon } from '@chakra-ui/react'
import { useAccount, useProvider, useSigner } from 'wagmi'
import { ethers } from 'ethers'

export default function Home() {
   
  // Wagmi
  const { address, isConnected } = useAccount();
  const provider = useProvider();
  const { data: signer } = useSigner();

  // from Chakra-UI
  const toast = useToast();

  const contractAddress = "0x4250823810e8f390FD44a4592FE149E55CFAa3e2";

  // The different useStates
  const [owner, setOwner] = useState('');
  const [voterAddress, setVoterAddress] = useState();
  const [status, setStatus] = useState('');

  const [isRegistered, setIsRegistered] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [voters, setVoters] = useState([]); // stores the results of the Voter struct in the SC 
  const [hasVoted, setHasVoted] = useState(false);
  const [winningProposal, setWinningProposal] = useState();

  const [spinner, setSpinner] = useState(false); // put a spinner while a tx is loading
  const [currentProposal, setCurrentProposal] = useState('');
  

  // Main useEffect to fetch events when the user is connected and load appropriate datas :
  useEffect(() => {
    if (isConnected) 
    {
      synchronize();
    }
  }, [address, isConnected])


  // 
  const synchronize = async () => {
    const contract = new ethers.Contract(contractAddress, Contract.abi, provider); // 'provider' : to read in the BC 

    // setup owner
    let owner = await contract.owner();
    setOwner(owner);

    // to fetch datas (events) from the BC :
    // --------- starts here
    let startBlock = 8418000 - 1; //update SC deployment block here
    let endBlock = await provider.getBlockNumber();

    let filter = { address: contractAddress };

    let eventsArray = [];
    for (let i = startBlock; i < endBlock; i += 500) 
    {
      const _startBlock = i;
      const _endBlock = Math.min(endBlock, i + 499);
      const events = await contract.queryFilter(filter, _startBlock, _endBlock);
      eventsArray = [...eventsArray, ...events];
    }
    // --------- ends here

    // arrays to push the main events we will need later
    // --------- starts here
    let voterRegistered = [];
    let proposalRegistered = [];
    let voted = [];
    let workflowStatusChange = [];

    eventsArray.forEach(e => {
      if (e.event === "VoterRegistered") 
      {
        voterRegistered.push(e.args);
      }
      else if (e.event === "WorkflowStatusChange") 
      {
        workflowStatusChange.push(e.args);
      }
      else if (e.event === "ProposalRegistered") 
      {
        proposalRegistered.push(Number(e.args.proposalId));
      }
      else if (e.event === "Voted") 
      {
        voted.push(e.args);
      }
    })
    
    // --------- ends here

    
    let voter = await getVoter(ethers.utils.getAddress(address));
    if (voter && voter.isRegistered)
    {
      setIsRegistered(true);
    } 
    else 
    {
      setIsRegistered(false);
    }
    
    if (voter && voter.hasVoted) 
    {
      setHasVoted(true);
    } 
    else 
    {
      setHasVoted(false);
    }
    
    // get Voters infos and Workflow Status
     // --------- starts here
    setVoters(voterRegistered.map(e => ethers.utils.getAddress(e.voterAddress)));
    let checkVoters = voters.map(async (voter) => {
      let vote = await getVoter(ethers.utils.getAddress(voter))
      return { votedProposalId: vote?.votedProposalId.toString(), isRegistered: vote?.isRegistered, hasVoted: vote?.hasVoted }
    })
    Promise.all(checkVoters).then(function (results) { setVoters(results) });
    let actualStatus = '';
    let maxStatus = -Infinity;

    for (let i = 0; i < workflowStatusChange.length; i++) 
    {
      let currentStatus = workflowStatusChange[i].newStatus;
      if (currentStatus > maxStatus) 
      {
        maxStatus = currentStatus;
      }
    }
    // --------- ends here
    
    if (maxStatus === 0) 
    {
      actualStatus = "Registering voters";
    } 
    else if (maxStatus === 1) 
    {
      actualStatus = "Proposals registration started";
    } 
    else if (maxStatus === 2) 
    {
      actualStatus = "Proposals registration ended";
    } 
    else if (maxStatus === 3) 
    {
      actualStatus = "Voting session started";
    } 
    else if (maxStatus === 4) 
    {
      actualStatus = "Voting session ended";
    } 
    else if (maxStatus === 5) 
    {
      actualStatus = "Votes tallied";
    } 
    else 
    {
      actualStatus = "Registering voters";
    }
    setStatus(actualStatus);

    // push fetchedProposals in proposal array :
    // --------- starts here
    const fetchedProposals = proposalRegistered.map(async (id) => {
      let proposalFound = await getOneProposal(id);
      return {
        id: id,
        description: proposalFound?.description,
        voteCount: voted.filter(e => Number(e.proposalId) === id).length
      }
    });
    Promise.all(fetchedProposals).then(function (results) { setProposals(results) });
    // --------- ends here

    // check for winning proposal : 
    // --------- starts here
    //if (actualStatus == "Voting session ended")
    //{
    let winningId = 0;
    for (let i = 0; i < proposals.length; i++) 
    {
        if (proposals[i].voteCount > proposals[winningId].voteCount)
            winningId = i;
    }
    setWinningProposal(winningId + 1 );
    //}
    // --------- ends here
    setCurrentProposal('');
    setVoterAddress('');
    setSpinner(false);
  }

  // ALL GETTERS FUNCTIONS (Read the Blockchain) :

  const getOneProposal = async (id) => {
    try {
      const contract = new ethers.Contract(contractAddress, Contract.abi, provider);
      let proposal = await contract.connect(address).getOneProposal(id);
      return proposal;
    }
    catch (e) {
    }
  }

  const getVoter = async (address) => {
    try {
      const contract = new ethers.Contract(contractAddress, Contract.abi, provider);
      let voterStruct = await contract.connect(address).getVoter(address);
      return voterStruct
    }
    catch (e) {
    }
  }


  // ALL SIGNER FUNCTIONS (Modify the Blockchain) :

  const addVoter = async (voterAddress) => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.addVoter(ethers.utils.getAddress(voterAddress));
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Voter Registered !",
        status: "success",
        isClosable: true
      });
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
      setVoterAddress("");
    }
  }

  const addProposal = async (description) => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.addProposal(description);
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Proposal submitted !",
        status: "success",
        isClosable: true
      })
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
      setCurrentProposal("");
    }
  }

  const setVote = async (id) => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.setVote(id);
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Vote submitted !",
        status: "success",
        isClosable: true
      })
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
    }
  }
 
  const startProposalsRegistering = async () => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.startProposalsRegistering();
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Proposal Registering started!",
        status: "success",
        isClosable: true
      });
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
    }
  }

  const startVotingSession = async () => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.startVotingSession();
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Voting session started!",
        status: "success",
        isClosable: true
      })
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
    }
  }

  const endProposalsRegistering = async () => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.endProposalsRegistering();
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Proposal Registering ended!",
        status: "success",
        isClosable: true
      })
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
    }
  }

  const endVotingSession = async () => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.endVotingSession();
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Voting session ended!",
        status: "success",
        isClosable: true
      })
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
    }
  }

  const tallyVotes = async () => {
    try {
      setSpinner(true);
      const contract = new ethers.Contract(contractAddress, Contract.abi, signer);
      let tx = await contract.tallyVotes();
      await tx.wait();
      synchronize();
      toast({
        duration: 3000,
        title: "Success",
        description: "Votes tallied!",
        status: "success",
        isClosable: true
      })
    }
    catch (e) {
      toast({
        duration: 3000,
        title: "Error",
        description: "Fatal Error... try again",
        status: "error",
        isClosable: true
      })
      setSpinner(false);
    }
  }

  const nextWorkflowStage = () => {
    if (status === "Registering voters") 
    {
      startProposalsRegistering();
    } 
    else if (status === "Proposals registration started") 
    {
      endProposalsRegistering();
    } 
    else if (status === "Proposals registration ended") 
    {
      startVotingSession();
    } 
    else if (status === "Voting session started") 
    {
      endVotingSession();
    } 
    else if (status === "Voting session ended") 
    {
      tallyVotes();
    } 
    else if (status === "Votes tallied") 
    {
      toast({
        duration: 3000,
        title: "The end",
        description: "Voting process fully ended, votes tallied!",
        status: "warning",
        isClosable: true
      });
    }
    
  }
 
return (
  <Flex 
      width="100%" 
      direction="column" 
      alignItems="center" 
      flexWrap="wrap">

    {isConnected ?
      <>
        <Flex 
          width="100%" 
          height="100%" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="space-between">
              <Flex width="100%" 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  margin="20px 0px" 
                  backgroundColor="#FFFDD0" 
                  padding={4} 
                  borderRadius={11}>
                  <Flex 
                      width="30%" 
                      direction="row" 
                      justifyContent="flex-start" 
                      alignItems="center">
                      {status && <Text margin="0px 20px 0px 5px" fontWeight="bold" >Current status : {status}</Text>}
                      {address === owner && status !== "Votes tallied" && <Button isLoading={spinner} colorScheme="blue" onClick={() => { nextWorkflowStage() }}>{status === "Voting session ended" ? "Tally votes" : "Next step"}</Button>}
                  </Flex>
              </Flex>
              {address === owner && status === "Registering voters" &&
                  <Flex 
                      width="100%" 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center" margin="20px 0px" 
                      backgroundColor="#FFFDD0" 
                      padding={4} 
                      borderRadius={11}>
                          <Text 
                              fontWeight="bold">
                              Address : 
                          </Text>
                          <Input 
                              placeholder={`Voter's address`} 
                              width="50%" 
                              margin="0px 20px 0px 20px" 
                              value={voterAddress} 
                              onChange={e => setVoterAddress(e.target.value)} />
                          <Button 
                          isLoading={spinner} 
                          colorScheme="blue" 
                          onClick={() => { addVoter(voterAddress) }}>
                          Add voter
                          </Button>
                  </Flex>
              }
              {status === "Proposals registration started" && isRegistered &&
                  <Flex 
                      width="100%" 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center" 
                      backgroundColor="#FFFDD0" 
                      padding={4} 
                      borderRadius={11}>
                      <Text 
                          fontWeight="bold">
                          Proposal :
                      </Text>
                      <Input 
                          margin="0px 20px 0px 20px" 
                          width="50%" placeholder={`Enter your proposal here`} 
                          value={currentProposal} 
                          onChange={e => setCurrentProposal(e.target.value)} />
                      <Button 
                          isLoading={spinner} 
                          colorScheme="blue" 
                          onClick={() => { addProposal(currentProposal) }}>
                          Add proposal
                      </Button>
                  </Flex>
              }
              {status === "Votes tallied" && isConnected &&
                  <Flex 
                      width="70%" 
                      direction="row" 
                      justifyContent="center" 
                      alignItems="center">
                      <Text 
                          fontWeight="bold">
                          Winning proposal : {winningProposal}
                      </Text>
                  </Flex>
              }
              {/* CONTENEUR HORIZONTAL CENTRE (GROS) */}
              <Flex 
                  grow="1"
                  width="100%" 
                  direction="row" 
                  justifyContent="space-evenly" 
                  flexWrap="wrap">
                  {isRegistered ?
                      proposals.map(proposal => {
                          return (
                          <Votes proposal={proposal} setVote={setVote} status={status} isRegistered={isRegistered} hasVoted={hasVoted} spinner={spinner} winningProposal={winningProposal} />
                          )
                      })
                  :
                  <Flex 
                      height="100%" 
                      width="100%" 
                      alignItems="center" 
                      justifyContent="center">
                      <Alert 
                          status="warning" 
                          width="300px">
                              <AlertIcon />
                              <Flex direction="column">
                              <Text 
                                  as="span">
                                  You are not registred yet...
                              </Text>
                              </Flex>
                      </Alert>
                  </Flex>
              }
              </Flex>
          </Flex>
          </>
          :
          <Flex 
              height="100%" 
              width="100%"
              alignItems="center"
              justifyContent="center">
              <Alert
                  status="warning" 
                  textAlign="center"
                  width="35vw"
                  height="19vh">
                  <AlertIcon />
                  <Flex direction="column">
                  <Text 
                      fontSize="40"
                      as="span">
                      Please connect a wallet...
                  </Text>
                  </Flex>
              </Alert>
          </Flex>
  }

  </Flex >

  )
};
