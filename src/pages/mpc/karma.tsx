import React, { useEffect, useState } from "react";
import { AppBackHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
/* @ts-ignore */
import { JIFFClient, JIFFClientNegative, JIFFClientBigNumber } from "jiff-mpc";
import { toast } from "sonner";
import { BigNumber } from "bignumber.js";
import Slider from "@mui/material/Slider";
import { Input } from "@/components/Input";
import { Room, RoomMember } from "@prisma/client";
import { Spinner } from "@/components/Spinner";
import { classed } from "@tw-classed/react";

enum OutputState {
  NOT_CONNECTED,
  AWAITING_OTHER_PARTIES_CONNECTION,
  CONNECTED,
  AWAITING_OTHER_PARTIES_INPUTS,
  COMPUTING,
  SHOW_RESULTS,
  ERROR,
}

const Title = classed.h3("block font-sans text-iron-950", {
  variants: {
    size: {
      small: "text-base leading-1 font-semibold",
      medium: "text-[21px] leading-5 font-medium",
    },
  },
  defaultVariants: {
    size: "small",
  },
});

const Description = classed.span("text-md text-iron-600 leading-5");

export default function Karma() {
  const [createRoomName, setCreateRoomName] = useState<string>();
  const [displayName, setDisplayName] = useState<string>("");
  const [createRoomPartyCount, setCreateRoomPartyCount] = useState<number>();
  const [roomName, setRoomName] = useState<string>();
  const [allRooms, setAllRooms] = useState<
    Record<string, Room & { members: RoomMember[] }>
  >({});
  const [jiffClient, setJiffClient] = useState<typeof JIFFClient | null>(null);
  const [output, setOutput] = useState<OutputState>(OutputState.NOT_CONNECTED);
  const [karmaResults, setKarmaResults] = useState<number[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [loadingCreateRoom, setLoadingCreateRoom] = useState<boolean>(false);
  const [loadingJoin, setLoadingJoin] = useState<number>();

  const [names, setNames] = useState<string[]>([]);
  const [karmas, setKarmas] = useState<number[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      const response = await fetch("/api/mpc/get_all_rooms");
      const { rooms } = await response.json();
      const roomsMapping = rooms.reduce(
        (acc: Record<string, Room>, room: Room) => {
          acc[room.name] = room;
          return acc;
        },
        {}
      );
      setCreateRoomName(undefined);
      setCreateRoomPartyCount(undefined);
      setDisplayName("");
      setLoadingRooms(false);
      setAllRooms(roomsMapping);
    };
    fetchRooms();
  }, []);

  const handleCreateRoom = async () => {
    setLoadingCreateRoom(true);
    if (!createRoomName || !createRoomPartyCount) {
      setLoadingCreateRoom(false);
      return toast.error("Please fill in all fields");
    }

    const newRoomName = "KARMA-" + createRoomName;

    if (createRoomPartyCount < 2) {
      setLoadingCreateRoom(false);
      return toast.error("Party count must be at least 2");
    }

    if (/\s/.test(createRoomName)) {
      setLoadingCreateRoom(false);
      return toast.error("Room name cannot contain whitespace");
    }

    const response = await fetch("/api/mpc/create_room", {
      method: "POST",
      body: JSON.stringify({
        name: newRoomName,
        numParties: createRoomPartyCount,
        password: "",
        displayName,
      }),
    });

    if (response.ok) {
      const response = await fetch("/api/mpc/get_all_rooms");
      const { rooms } = await response.json();
      const roomsMapping = rooms.reduce(
        (acc: Record<string, Room>, room: Room) => {
          acc[room.name] = room;
          return acc;
        },
        {}
      );
      setAllRooms(roomsMapping);
      setRoomName(newRoomName);
      connect(newRoomName, roomsMapping[newRoomName].id, createRoomPartyCount);
      toast.success("Room created successfully");
    } else {
      const { error } = await response.json();
      toast.error(error);
    }
    setLoadingCreateRoom(false);
  };

  const connect = (roomName: string, roomId: number, numParties: number) => {
    if (!roomName || numParties < 2) {
      toast.error("Please enter a valid room name and party count.");
      return;
    }

    const client = new JIFFClient(
      process.env.NODE_ENV === "development"
        ? "http://localhost:8080"
        : "https://mpc-fruits.onrender.com",
      roomName,
      {
        autoConnect: false,
        party_count: numParties,
        crypto_provider: true,
        // @ts-ignore
        onError: (_, error) => {
          console.error(error);
          if (
            error.includes("Maximum parties capacity reached") ||
            error.includes("contradicting party count")
          ) {
            setLoadingJoin(undefined);
            setLoadingCreateRoom(false);
            toast.error("Computation is full. Try another computation ID.");
          }
          setOutput(OutputState.ERROR);
        },
        onConnect: async () => {
          console.log("Connected to server");

          const response = await fetch(
            `/api/mpc/get_room_names?roomId=${roomId}`
          );
          const { roomNames } = await response.json();
          if (!roomNames) {
            setOutput(OutputState.ERROR);
            return;
          }
          console.log(roomNames);
          setNames(roomNames);
          setKarmas(new Array(numParties).fill(0));
          setOutput(OutputState.CONNECTED);
        },
      }
    );

    client.apply_extension(JIFFClientBigNumber, {});
    client.apply_extension(JIFFClientNegative, {});
    client.connect();
    setOutput(OutputState.AWAITING_OTHER_PARTIES_CONNECTION);
    setJiffClient(client);
  };

  const submit = async () => {
    if (!karmas) {
      toast.error("Please update everyone's karma.");
      return;
    }

    setOutput(OutputState.AWAITING_OTHER_PARTIES_INPUTS);

    if (karmas.length !== jiffClient.party_count) {
      toast.error("Error with karma data. Please restart.");
      return;
    }

    if (jiffClient) {
      console.log(`Beginning MPC with karmas ${karmas}`);
      let shares = await jiffClient.share_array(karmas);
      console.log("Shares: ", shares);
      setOutput(OutputState.COMPUTING);

      // Start average computation
      const startKarmaTime = Date.now();

      let rowSumShares: any[] = [];
      let colSumShares: any[] = [];

      for (let j = 0; j < jiffClient.party_count; j++) {
        for (let i = 1; i <= jiffClient.party_count; i++) {
          if (j === 0) {
            colSumShares.push(shares[i][j]);
          } else {
            colSumShares[i - 1] = colSumShares[i - 1].sadd(shares[i][j]);
          }
        }
      }

      for (let i = 1; i <= jiffClient.party_count; i++) {
        for (let j = 0; j < jiffClient.party_count; j++) {
          if (i === 1) {
            rowSumShares.push(shares[i][j]);
          } else {
            rowSumShares[j] = rowSumShares[j].sadd(shares[i][j]);
          }
        }
      }

      const rowResults = await Promise.all(
        rowSumShares.map((share: any) => jiffClient.open(share))
      );
      const colResults = await Promise.all(
        colSumShares.map((share: any) => jiffClient.open(share))
      );
      console.log("Row Results: ", rowResults);
      console.log("Col Results: ", colResults);

      const karmaTime = Date.now() - startKarmaTime;
      console.log("Karma Time: ", karmaTime);

      const karmaResults = rowResults.map(
        (rowResult: any, index: number) => rowResult - colResults[index]
      );
      setKarmaResults(karmaResults);
      setOutput(OutputState.SHOW_RESULTS);
      toast.success(`MPC runtime: ${karmaTime}ms`);
    }
  };

  const getButtonDisplay = (): string => {
    switch (output) {
      case OutputState.NOT_CONNECTED:
        return "Connect";
      case OutputState.AWAITING_OTHER_PARTIES_CONNECTION:
        return "Awaiting other parties connection...";
      case OutputState.CONNECTED:
        return "Submit ratings to proceed!";
      case OutputState.AWAITING_OTHER_PARTIES_INPUTS:
        return "Awaiting other parties inputs...";
      case OutputState.COMPUTING:
        return "Computing...";
      case OutputState.SHOW_RESULTS:
        return "Karma has been assigned.";
      case OutputState.ERROR:
        return "Error - please try again";
    }
  };

  if (roomName) {
    return (
      <div>
        <AppBackHeader
          onBackClick={() => {
            if (output !== OutputState.SHOW_RESULTS) {
              let choice = window.confirm(
                "Are you sure you want to leave? This will end the computation for the entire room."
              );
              if (choice) {
                setRoomName(undefined);
              }
            } else {
              setRoomName(undefined);
            }
          }}
        />

        <div className="flex flex-col gap-6 h-modal">
          <div className="flex flex-col gap-4">
            <span className="text-lg xs:text-xl text-iron-950 leading-6 font-medium">
              ✨ Karma Calculator
            </span>
            <span className="text-iron-600 text-sm font-normal">
              {`Update each other's karma privately, only reveal the net karma
              given/received at the end of the round. Inspired by Barry & CC.`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-lg xs:text-xl text-iron-950 leading-6 font-medium">
              {roomName.slice(6)}
            </span>
            <Description>{getButtonDisplay()}</Description>
          </div>
          <div>
            {output === OutputState.CONNECTED && (
              <div className="mb-16">
                {names.map((name, index) => (
                  <div key={index} className="mb-4">
                    <label className="block text-black mb-2">{name}</label>
                    <div className="mx-4">
                      <Slider
                        name={`karma-${index}`}
                        value={karmas[index]}
                        onChange={(event, newValue) => {
                          const newRatings = [...karmas];
                          newRatings[index] = Array.isArray(newValue)
                            ? newValue[0] || 0
                            : newValue || 0;
                          setKarmas(newRatings);
                        }}
                        min={-100}
                        max={100}
                        marks={[
                          { value: -100, label: "-100" },
                          { value: 0, label: "0" },
                          { value: 100, label: "100" },
                        ]}
                        valueLabelDisplay="auto"
                      />
                    </div>
                  </div>
                ))}
                <Button onClick={submit}>Submit</Button>
              </div>
            )}
            {output === OutputState.SHOW_RESULTS && (
              <div className="text-black">
                <div className="flex flex-col gap-4">
                  {names
                    .map((name, index) => ({
                      name,
                      karma: karmaResults[index],
                    }))
                    .sort((a, b) => b.karma - a.karma)
                    .map(({ name, karma }, index) => (
                      <div
                        className="flex flex-row align-center gap-2"
                        key={index}
                      >
                        {`${name}, Karma: ${karma}`}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppBackHeader />

      <div className="flex flex-col gap-6 h-modal">
        <div className="flex flex-col gap-4">
          <span className="text-lg xs:text-xl text-iron-950 leading-6 font-medium">
            ✨ Karma Calculator
          </span>
          <div className="flex flex-col gap-2">
            <span className="text-iron-600 text-sm font-normal">
              {`Update each other's karma privately, only reveal the net karma
              given/received at the end of the round. Inspired by Barry & CC.`}
            </span>
            <span className="text-iron-600 text-sm font-normal">
              {`Find a group of 3 or more people 
              and set your party size accordingly.`}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Title>Join a room</Title>
            <div className="flex flex-col gap-2">
              {loadingRooms ? (
                <Spinner />
              ) : Object.values(allRooms).filter(
                  (room) =>
                    room.members.length < room.numParties &&
                    room.name.startsWith("KARMA-")
                ).length === 0 ? (
                <span className="text-iron-600 text-sm font-normal">
                  No rooms available
                </span>
              ) : (
                Object.values(allRooms).map((room) =>
                  room.members.length < room.numParties &&
                  room.name.startsWith("KARMA-") ? (
                    <div
                      key={room.id}
                      className="flex items-center justify-between"
                    >
                      <Description>
                        {room.name.slice(6)} ({room.members.length}/
                        {room.numParties} members)
                      </Description>
                      <div className="max-w-[100px] ml-auto py-2">
                        <Button
                          size="small"
                          variant="tertiary"
                          disabled={
                            loadingJoin !== undefined && loadingJoin !== room.id
                          }
                          loading={loadingJoin === room.id}
                          onClick={async () => {
                            let chosenDisplayName = null;

                            while (chosenDisplayName === null) {
                              chosenDisplayName = window.prompt(
                                "Enter your display name."
                              );
                            }

                            setLoadingJoin(room.id);

                            const response = await fetch("/api/mpc/join_room", {
                              method: "POST",
                              body: JSON.stringify({
                                roomId: room.id,
                                password: "",
                                displayName: chosenDisplayName,
                              }),
                            });
                            if (!response.ok) {
                              const { error } = await response.json();
                              setLoadingJoin(undefined);
                              return toast.error(error);
                            }

                            setRoomName(room.name);
                            connect(room.name, room.id, room.numParties);
                            setLoadingJoin(undefined);
                          }}
                        >
                          Join
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <></>
                  )
                )
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4 mb-16">
            <div className="flex flex-col gap-1 ">
              <Title>Create new room</Title>
            </div>
            <Input
              label="Room name"
              value={createRoomName}
              onChange={(e) => setCreateRoomName(e.target.value)}
            />
            <Input
              label="Party count"
              type="number"
              value={createRoomPartyCount}
              onChange={(e) =>
                e.target.value
                  ? setCreateRoomPartyCount(Number(e.target.value))
                  : setCreateRoomPartyCount(undefined)
              }
            />
            <Input
              label="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Button onClick={handleCreateRoom} loading={loadingCreateRoom}>
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Karma.getInitialProps = () => {
  return { showHeader: false, showFooter: false };
};
