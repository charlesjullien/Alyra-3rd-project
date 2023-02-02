import { Button, Text, Card, CardHeader, CardBody, CardFooter, Flex } from '@chakra-ui/react'
import { useAccount } from 'wagmi'
import { Fade, ScaleFade, Slide, SlideFade, useDisclosure, Box } from '@chakra-ui/react'


export const Votes = ({ isRegistered, hasVoted, proposal, setVote, status, loading, winningProposal }) => {
    const { address } = useAccount();

    function SlideEx() {
        const { isOpen, onToggle } = useDisclosure()
      
        return (
          <>
            <Button colorScheme="green" onClick={onToggle}>Infos &#128064;</Button>
            <Slide direction='bottom' in={isOpen} style={{ zIndex: 10 }}>
              <Box
                p='40px'
                color='white'
                mt='4'
                bg='#9370DB'
                rounded='md'
                shadow='md'
              >
                <Text 
                textAlign="center"
                justifyContent="center"
                fontWeight="650"
                fontSize={25}>
                    &#128227; {proposal.description}
                    </Text>
              </Box>
            </Slide>
          </>
        )
      }

    return (
        <Card margin="3" minWidth="18%" height="65%" backgroundColor={status === "Votes tallied" && winningProposal === proposal.id ? "#228B22" : "#FFFDD0"}>
            <CardBody>
                <Flex 
                    height="100%" 
                    direction="column" 
                    justifyContent="space-between" 
                    alignItems="center">
                        <Flex 
                            width="100%" 
                            direction="row" 
                            justifyContent="space-between" 
                            alignItems="center" >
                                <Text 
                                    marginBottom="2" 
                                    width="30%" textAlign="start" 
                                    fontWeight="650"> 
                                    &#128220; id:{proposal.id}
                                </Text>
                                <Text 
                                    marginBottom="2" 
                                    width="30%" 
                                    textAlign="end" 
                                    fontWeight="650"> 
                                    &#9997; :{proposal.voteCount}
                                </Text>
                        </Flex>
                        {SlideEx()}
                        {status === "Voting session started" && isRegistered && !hasVoted ?
                        <Button 
                            isLoading={loading} 
                            colorScheme="green" width="32%" 
                            onClick={()=>{setVote(proposal.id)}}>
                            Vote &#128275;
                        </Button>
                        :
                        <Button 
                            cursor="not-allowed" 
                            colorScheme="gray" 
                            width="32%">
                            Vote &#128274;
                        </Button>}
                </Flex>
            </CardBody>
        </Card>
    )
}