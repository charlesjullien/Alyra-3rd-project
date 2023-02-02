import { Layout } from '../components/Layout';
import '@/styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css';
import {
  darkTheme,
  getDefaultWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { configureChains, createClient, WagmiConfig } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { hardhat, goerli } from 'wagmi/chains';
import { ChakraProvider } from '@chakra-ui/react'

// Setup chains and web3 provider
const { chains, provider } = configureChains(
  [goerli, hardhat],
  [publicProvider()]
);

// get connectors for WagmiClient
const { connectors } = getDefaultWallets({
  appName: 'My Voting dApp',
  chains
});

// generate Wagmi client
const wagmiClient = createClient({
  autoConnect: false,
  connectors,
  provider
})

export default function App({ Component, pageProps }) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains} theme={darkTheme({accentColor: '#8A2BE2'})}>
        <ChakraProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ChakraProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}