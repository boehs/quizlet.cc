import {
  Avatar,
  Box,
  Center,
  Flex,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";
import type { User } from "@prisma/client";
import {
  IconBooks,
  IconCloudDownload,
  IconFolder,
  IconFolderPlus,
  IconHome,
  IconLink,
  IconMoon,
  IconPlus,
  IconSettings,
  IconSun,
  IconUser,
  IconUserCircle,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";
import { env } from "../env/client.mjs";
import { menuEventChannel } from "../events/menu";
import { useShortcut } from "../hooks/use-shortcut";
import { api } from "../utils/api";
import { avatarUrl } from "../utils/avatar";

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntityType = "set" | "folder";

interface Entity {
  id: string;
  name: string;
  type: EntityType;
  author: Pick<User, "username" | "image">;
  viewedAt: Date;
}

interface MenuOption {
  icon: React.ReactNode;
  name: string;
  searchableName?: string;
  label?: string;
  action: (ctrl: boolean) => void | Promise<void>;
  entity?: Entity;
  shouldShow?: () => boolean;
  loadable?: boolean;
  isLoading?: boolean;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const session = useSession();
  const { colorMode, toggleColorMode } = useColorMode();

  const onSet = router.pathname == "/sets/[id]";
  const onFolder = router.pathname == "/profile/[username]/folders/[slug]";

  const url = (id: string) => `${env.NEXT_PUBLIC_BASE_URL}/_${id}`;
  const onSuccess = (id: string) => {
    void (async () => {
      await navigator.clipboard.writeText(url(id));
    })();
    onClose();
  };

  const getSetShareId = api.studySets.getShareId.useQuery(
    router.query.id as string,
    {
      enabled: false,
      refetchOnWindowFocus: false,
      onSuccess,
    }
  );

  const getFolderShareId = api.folders.getShareIdByUsername.useQuery(
    {
      idOrSlug: router.query.slug as string,
      username: ((router.query.username as string) || "").slice(1),
    },
    {
      enabled: false,
      refetchOnWindowFocus: false,
      onSuccess,
    }
  );

  const [options, setOptions] = React.useState<MenuOption[]>([]);

  const recentQuery = api.recent.get.useQuery(undefined, {
    enabled: isOpen,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      let total: MenuOption[] = [];

      for (const set of data.sets) {
        total.push({
          icon: <IconBooks />,
          name: set.title,
          searchableName: set.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
          action: (ctrl) => openLink(`/${set.id}`, ctrl),
          entity: {
            id: set.id,
            name: set.title,
            type: "set",
            author: set.user,
            viewedAt: set.viewedAt,
          },
          shouldShow: () => !window.location.pathname.startsWith(`/${set.id}`),
        });
      }
      for (const folder of data.folders) {
        const url = `/@${folder.user.username}/folders/${
          folder.slug ?? folder.id
        }`;

        total.push({
          icon: <IconFolder />,
          name: folder.title,
          searchableName: folder.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
          action: (ctrl) => openLink(url, ctrl),
          entity: {
            id: folder.id,
            name: folder.title,
            type: "folder",
            author: folder.user,
            viewedAt: folder.viewedAt,
          },
          shouldShow: () => !window.location.pathname.startsWith(url),
        });
      }

      total = total.sort(
        (a, b) =>
          (b.entity?.viewedAt.getTime() || 0) -
          (a.entity?.viewedAt.getTime() || 0)
      );

      if (onSet || onFolder) {
        total.push({
          icon: <IconLink />,
          name: "Copy Link",
          label: `Copy the URL for this ${onSet ? "set" : "folder"}`,
          action: async () => {
            if (onSet) await getSetShareId.refetch();
            if (onFolder) await getFolderShareId.refetch();
          },
          loadable: true,
        });
      }

      total.push({
        icon: <IconHome />,
        name: "Home",
        label: "Navigate home",
        action: (ctrl) => openLink(`/home`, ctrl),
        shouldShow: () => window.location.pathname !== "/home",
      });
      if (session.data?.user?.admin) {
        total.push({
          icon: <IconUserCircle />,
          name: "Admin",
          label: "Navigate to admin panel",
          action: (ctrl) => openLink(`/admin`, ctrl),
          shouldShow: () => window.location.pathname !== "/admin",
        });
      }

      total.push({
        icon: <IconUser />,
        name: "Profile",
        label: "Navigate to your profile",
        action: (ctrl) =>
          openLink(`/@${session.data?.user?.username || ""}`, ctrl),
        shouldShow: () =>
          window.location.pathname !==
          `/@${session.data?.user?.username || ""}`,
      });
      total.push({
        icon: <IconSettings />,
        name: "Settings",
        label: "Navigate to settings",
        action: (ctrl) => openLink(`/settings`, ctrl),
        shouldShow: () => window.location.pathname !== "/settings",
      });

      total.push({
        icon: <IconPlus />,
        name: "Create Study Set",
        label: "Create a new study set",
        action: (ctrl) => openLink(`/create`, ctrl),
        shouldShow: () => window.location.pathname !== "/create",
      });
      total.push({
        icon: <IconCloudDownload />,
        name: "Import From Quizlet",
        label: "Import a study set from Quizlet.com",
        action: () => menuEventChannel.emit("openImportDialog"),
      });
      total.push({
        icon: <IconFolderPlus />,
        name: "Create Folder",
        label: "Create a new folder",
        action: () => menuEventChannel.emit("createFolder"),
      });

      total.push({
        icon: colorMode == "dark" ? <IconSun /> : <IconMoon />,
        name: "Toggle Theme",
        label: `Switch to ${colorMode == "dark" ? "light" : "dark"} mode`,
        action: toggleColorMode,
      });

      setOptions(total);
    },
  });

  const [query, setQuery] = React.useState("");
  const [selectionIndex, setSelectionIndex] = React.useState(0);
  const [ignoreMouse, setIgnoreMouse] = React.useState(false);

  const filteredOptions: MenuOption[] = options
    .filter((o) => (!!o.shouldShow ? o.shouldShow() : true))
    .filter((e) =>
      (e.searchableName ?? e.name).toLowerCase().includes(query.toLowerCase())
    );

  const openLink = (link: string, ctrl: boolean) => {
    void (async () => {
      if (ctrl) {
        window.open(link, "_blank");
      } else {
        await router.push(link);
      }
    })();
  };

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const resultsRef = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    resultsRef.current = resultsRef.current.slice(0, filteredOptions?.length);
  }, [filteredOptions]);

  React.useEffect(() => {
    setSelectionIndex(0);
  }, [filteredOptions?.length]);

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
    setSelectionIndex(0);
  }, [isOpen]);

  const onSubmit = (i: number, ctrl: boolean) => {
    const option = filteredOptions[i]!;

    void (async () => {
      await option.action(ctrl);
    })();

    if (option.loadable) {
      option.isLoading = true;
      setOptions([...options]);
      return;
    }
    onClose();
  };

  const borderColor = useColorModeValue("gray.200", "gray.750");
  const cursorBg = useColorModeValue(
    "rgba(226, 232, 240, 50%)",
    "rgba(45, 55, 72, 50%)"
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl">
      <ModalOverlay
        backdropFilter="blur(12px)"
        backgroundColor={useColorModeValue(
          "rgba(247, 250, 252, 75%)",
          "rgba(23, 25, 35, 40%)"
        )}
      />
      <ModalContent
        background={useColorModeValue(
          "rgba(247, 250, 252, 40%)",
          "rgba(23, 25, 35, 60%)"
        )}
        backdropFilter="blur(12px)"
        borderWidth="2px"
        rounded="xl"
        borderColor={borderColor}
        shadow="xl"
      >
        <ModalBody p="0">
          {isOpen && (
            <ShortcutsManager
              filteredOptions={filteredOptions}
              selectionIndex={selectionIndex}
              setSelectionIndex={setSelectionIndex}
              setIgnoreMouse={setIgnoreMouse}
              resultsRef={resultsRef}
              scrollRef={scrollRef}
              onSubmit={(ctrl) => onSubmit(selectionIndex, ctrl)}
            />
          )}
          <Box
            py="5"
            px="7"
            borderBottomWidth="2px"
            borderBottomColor={borderColor}
          >
            <Input
              placeholder="Where would you like to go?"
              size="lg"
              variant="unstyled"
              fontSize="2xl"
              px="0"
              _placeholder={{
                color: "gray.500",
              }}
              color={useColorModeValue("gray.900", "whiteAlpha.900")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Box>
          <Box
            overflow={filteredOptions.length > 6 ? "auto" : "hidden"}
            px="4"
            my="4"
            pos="relative"
            transition="height cubic-bezier(.4,0,.2,1) 300ms"
            style={{
              height:
                recentQuery.isLoading && !filteredOptions.length
                  ? 64
                  : 72 * (filteredOptions || []).slice(0, 6).length,
            }}
            ref={scrollRef}
          >
            {!!filteredOptions.length && (
              <Box
                pos="absolute"
                h="72px"
                w="full"
                top="0"
                left="0"
                px="4"
                transition="transform cubic-bezier(.4,0,.2,1) 200ms"
                style={{
                  transform: `translateY(${selectionIndex * 72}px)`,
                }}
              >
                <Box bg={cursorBg} rounded="xl" w="full" h="full" />
              </Box>
            )}
            {recentQuery.isLoading && !filteredOptions.length && (
              <Center w="full" h="16">
                <Spinner color="blue.300" />
              </Center>
            )}
            {filteredOptions.map((o, i) => (
              <OptionComp
                key={i}
                index={i}
                icon={o.icon}
                name={o.name}
                label={o.label}
                author={o.entity?.author}
                resultsRef={resultsRef}
                selectionIndex={selectionIndex}
                setSelectionIndex={setSelectionIndex}
                isLoading={o.isLoading}
                ignoreMouse={ignoreMouse}
                setIgnoreMouse={setIgnoreMouse}
                onClick={(e) => onSubmit(i, e.ctrlKey)}
              />
            ))}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

interface OptionCompProps {
  index: number;
  icon: React.ReactNode;
  name: string;
  author?: Pick<User, "username" | "image">;
  label?: string;
  resultsRef: React.MutableRefObject<(HTMLDivElement | null)[]>;
  selectionIndex: number;
  setSelectionIndex: React.Dispatch<React.SetStateAction<number>>;
  isLoading?: boolean;
  ignoreMouse: boolean;
  setIgnoreMouse: React.Dispatch<React.SetStateAction<boolean>>;
  onClick: React.MouseEventHandler<HTMLDivElement>;
}

const OptionComp: React.FC<OptionCompProps> = ({
  index,
  icon,
  name,
  author,
  label,
  resultsRef,
  selectionIndex,
  setSelectionIndex,
  ignoreMouse,
  isLoading,
  setIgnoreMouse,
  onClick,
}) => {
  const baseText = useColorModeValue("gray.600", "whiteAlpha.700");
  const highlightText = useColorModeValue("gray.900", "whiteAlpha.900");
  const baseColor = useColorModeValue("gray.500", "gray.400");
  const highlightColor = useColorModeValue("gray.900", "gray.50");

  return (
    <Flex
      alignItems="center"
      p="4"
      ref={(el) => (resultsRef.current[index] = el)}
      gap="4"
      h="72px"
      pos="relative"
      cursor="pointer"
      w="full"
      onPointerEnter={() => {
        if (!ignoreMouse) setSelectionIndex(index);
      }}
      onPointerMove={() => {
        setIgnoreMouse(false);
        setSelectionIndex(index);
      }}
      onClick={onClick}
    >
      <Box
        transition="all cubic-bezier(.4,0,.2,1) 300ms"
        color={selectionIndex == index ? highlightColor : baseColor}
        transform={
          selectionIndex == index
            ? "rotate(-10deg) scale(1.1)"
            : "rotate(0deg) scale(1)"
        }
      >
        {!isLoading ? (
          icon
        ) : (
          <Center boxSize="6">
            <Spinner boxSize="4" />
          </Center>
        )}
      </Box>
      <Stack spacing={1} w="full" overflow="hidden">
        <Text
          fontSize="lg"
          fontWeight={600}
          fontFamily="Outfit"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          transition="color cubic-bezier(.4,0,.2,1) 300ms"
          color={selectionIndex === index ? highlightText : baseText}
        >
          {name}
        </Text>
        {author && (
          <HStack>
            <Avatar
              src={avatarUrl(author)}
              size="2xs"
              className="highlight-block"
            />
            <Text fontSize="xs" color={baseText} className="highlight-block">
              {author.username}
            </Text>
          </HStack>
        )}
        {label && (
          <Text fontSize="xs" color={baseText}>
            {label}
          </Text>
        )}
      </Stack>
    </Flex>
  );
};

interface ShortcutsManagerProps {
  filteredOptions: MenuOption[];
  selectionIndex: number;
  setSelectionIndex: React.Dispatch<React.SetStateAction<number>>;
  setIgnoreMouse: React.Dispatch<React.SetStateAction<boolean>>;
  resultsRef: React.MutableRefObject<(HTMLDivElement | null)[]>;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onSubmit: (ctrl: boolean) => void;
}

const ShortcutsManager: React.FC<ShortcutsManagerProps> = ({
  filteredOptions: filteredEvents,
  selectionIndex,
  setSelectionIndex,
  setIgnoreMouse,
  resultsRef,
  scrollRef,
  onSubmit,
}) => {
  const isScrolledIntoView = (el: HTMLDivElement) => {
    const container = scrollRef.current!;

    const rect = el.getBoundingClientRect();
    const { bottom, top } = rect;
    let { height } = rect;

    const containerRect = container.getBoundingClientRect();
    height = height - 72;

    const visible =
      top <= containerRect.top
        ? containerRect.top - top <= height
        : bottom - containerRect.bottom <= height;

    return visible;
  };

  useShortcut(
    ["ArrowDown", "Tab"],
    () => {
      if (!filteredEvents.length) return;

      setIgnoreMouse(true);
      setSelectionIndex((i) => {
        const next = i < filteredEvents.length - 1 ? i + 1 : 0;
        const scrollTo = next;
        if (!isScrolledIntoView(resultsRef.current[scrollTo]!))
          resultsRef.current[scrollTo]!.scrollIntoView(false);

        return next;
      });
    },
    {
      ctrlKey: false,
      shiftKey: false,
    }
  );

  const up = () => {
    if (!filteredEvents.length) return;

    setIgnoreMouse(true);
    setSelectionIndex((i) => {
      const next = i > 0 ? i - 1 : filteredEvents.length - 1;
      const scrollTo =
        next == filteredEvents.length - 1
          ? next
          : Math.max(selectionIndex - 1, 0);

      if (!isScrolledIntoView(resultsRef.current[scrollTo]!))
        resultsRef.current[scrollTo]!.scrollIntoView();

      return next;
    });
  };

  useShortcut(["ArrowUp"], up, {
    ctrlKey: false,
  });
  useShortcut(["Tab"], up, {
    ctrlKey: false,
    shiftKey: "Tab",
  });

  useShortcut(
    ["Enter"],
    () => {
      if (!!filteredEvents.length) onSubmit(false);
    },
    {
      ctrlKey: false,
    }
  );
  useShortcut(
    ["Enter"],
    () => {
      if (!!filteredEvents.length) onSubmit(true);
    },
    {
      ctrlKey: true,
    }
  );

  return <></>;
};
