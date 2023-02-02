import { Flex } from '@chakra-ui/react'
import { Header } from "./Header";
import { Footer } from "./Footer";

export const Layout = ({ children }) => {
    return (
        <Flex 
            direction="column"
            minHeight="100vh"
            background="linear-gradient(to right, #4568dc, #b06ab3)">
                <Header />
                <Flex flexGrow="1" p="2rem">
                    {children}
                </Flex>
                <Footer />
        </Flex>
    )
}

