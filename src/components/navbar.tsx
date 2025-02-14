import {
  Avatar,
  AvatarBadge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  useDisclosure,
} from "@chakra-ui/react";
import { IconMenu, IconX } from "@tabler/icons-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";
import { menuEventChannel } from "../events/menu";
import { BASE_PAGES } from "../pages/_app";
import { avatarUrl } from "../utils/avatar";
import { CreateFolderModal } from "./create-folder-modal";
import { ImportFromQuizletModal } from "./import-from-quizlet-modal";
import { Link } from "./link";
import { LeftNav } from "./navbar/left-nav";
import { MobileMenu } from "./navbar/mobile-menu";
import { UserMenu } from "./navbar/user-menu";

export const Navbar: React.FC = () => {
  const router = useRouter();
  const onStaticPage = BASE_PAGES.includes(router.pathname);

  const { data: session, status } = useSession();
  const { isOpen: isMobileMenuOpen, onToggle: onMobileMenuToggle } =
    useDisclosure();
  const user = session?.user;

  const [folderModalOpen, setFolderModalOpen] = React.useState(false);
  const [folderChildSetId, setFolderChildSetId] = React.useState<string>();
  const [importModalOpen, setImportModalOpen] = React.useState(false);

  React.useEffect(() => {
    const createFolder = (setId?: string) => {
      setFolderChildSetId(setId);
      setFolderModalOpen(true);
    };
    const openImportDialog = () => {
      setImportModalOpen(true);
    };

    menuEventChannel.on("createFolder", createFolder);
    menuEventChannel.on("openImportDialog", openImportDialog);
    return () => {
      menuEventChannel.off("createFolder", createFolder);
      menuEventChannel.off("openImportDialog", openImportDialog);
    };
  }, []);

  return (
    <>
      <CreateFolderModal
        isOpen={folderModalOpen}
        onClose={() => {
          setFolderModalOpen(false);
          setFolderChildSetId(undefined);
        }}
        childSetId={folderChildSetId}
      />
      <ImportFromQuizletModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
        }}
      />
      <Flex
        pos="relative"
        zIndex={1000}
        w="full"
        bg={onStaticPage ? "gray.900" : undefined}
      >
        <HStack
          as="header"
          aria-label="Main navigation"
          maxW={onStaticPage ? "7xl" : undefined}
          w="full"
          mx="auto"
          px={{ base: "6", md: "8" }}
          py="4"
          justify="space-between"
        >
          <LeftNav
            onFolderClick={() => setFolderModalOpen(true)}
            onImportClick={() => setImportModalOpen(true)}
          />
          <Box display={["block", "block", "none"]}>
            <HStack>
              {user && (
                <Avatar
                  src={avatarUrl({
                    ...user,
                    image: user.image!,
                  })}
                  size="sm"
                  className="highlight-block"
                >
                  <AvatarBadge boxSize="1em" bg="green.500" />
                </Avatar>
              )}
              <IconButton
                aria-label={"Open menu"}
                icon={
                  isMobileMenuOpen ? (
                    <IconX size={20} />
                  ) : (
                    <IconMenu size={20} />
                  )
                }
                variant="ghost"
                colorScheme="gray"
                onClick={onMobileMenuToggle}
              />
            </HStack>
            <MobileMenu
              isOpen={isMobileMenuOpen}
              onClose={onMobileMenuToggle}
              onFolderClick={() => setFolderModalOpen(true)}
              onImportClick={() => setImportModalOpen(true)}
            />
          </Box>
          <HStack
            as="nav"
            spacing={4}
            display={["none", "none", "flex"]}
            height="12"
          >
            {session?.user && <UserMenu />}
            {status !== "loading" && !session && (
              <>
                <Button
                  colorScheme="blue"
                  variant="outline"
                  onClick={async () => {
                    await signIn("google", {
                      callbackUrl: "/home",
                    });
                  }}
                >
                  Log in
                </Button>
                <Button as={Link} href={"/signup"}>
                  Sign up for free
                </Button>
              </>
            )}
          </HStack>
        </HStack>
      </Flex>
    </>
  );
};
