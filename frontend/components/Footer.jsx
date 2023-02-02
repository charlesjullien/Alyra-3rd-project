import { Flex, Text } from '@chakra-ui/react'

export const Footer = () => {
    return (
        <Flex h="10vh" p="3rem" justifyContent="left" alignItems="left">
            <Text> &copy; Charles JULLIEN  &#127774; { new Date().getFullYear() } </Text>
        </Flex>
    )
}