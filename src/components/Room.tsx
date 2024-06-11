import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";

// const URL = "http://localhost:3000";
// const URL = "https://webrtc-socket-video-call-server.vercel.app";
const URL = "https://webrtc-socket-video-call-server.onrender.com";

export const Room = ({
  name,
  localAudioTrack,
  localVideoTrack,
}: {
  name: string;
  localAudioTrack: MediaStreamTrack | null;
  localVideoTrack: MediaStreamTrack | null;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [socket, setSocket] = useState<null | Socket>(null);
  const [connected, setConnected] = useState(false);
  const [lobby, setLobby] = useState(true);

  const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
  const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(
    null
  );
  const [remoteVideoTrack, setRemoteVideoTrack] =
    useState<null | MediaStreamTrack>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] =
    useState<null | MediaStreamTrack>(null);
  const [remoteMediaStream, setRemoteMediaStream] =
    useState<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // const name = searchParams.get("name");

  useEffect(() => {
    // Logic to init user to the room
    const socket = io(URL);

    socket.on("send-offer", async ({ roomId }) => {
      // alert("Send offer please");
      setLobby(false);
      const pc = new RTCPeerConnection();
      setSendingPc(pc);
      if (localVideoTrack) {
        pc.addTrack(localVideoTrack);
      }
      if (localAudioTrack) {
        pc.addTrack(localAudioTrack);
      }

      pc.onicecandidate = async (e) => {
        if (!e.candidate) {
          return;
        }
        console.log("on ice candidate receiving side");
        if (e.candidate) {
          socket.emit("add-ice-candidate", {
            candidate: e.candidate,
            type: "sender",
            roomId,
          });
        }
      };
      pc.onnegotiationneeded = async () => {
        const sdp = await pc.createOffer();
        // @ts-ignore
        pc.setLocalDescription(sdp);
        socket.emit("offer", {
          sdp,
          roomId,
        });
      };
    });

    socket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
      // alert("Send answer please");
      setLobby(false);

      const pc = new RTCPeerConnection();
      pc.setRemoteDescription(remoteSdp);
      const sdp = await pc.createAnswer();
      // @ts-ignore
      pc.setLocalDescription(sdp);
      const stream = new MediaStream();
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setRemoteMediaStream(stream);
      // trickle ice
      setReceivingPc(pc);

      // window.pcr = pc;

      pc.ontrack = (e) => {
        // const { track, type } = e;
        // if (type === "audio") {
        //   // setRemoteAudioTrack(track);
        //   // @ts-ignore
        //   remoteVideoRef.current?.srcObject.addTrack(track);
        // } else {
        //   // setRemoteVideoTrack(track);
        //   // @ts-ignore
        //   remoteVideoRef.current?.srcObject.addTrack(track);
        // }
        // // @ts-ignore
        // remoteVideoRef.current?.play();
      };

      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          socket.emit("add-ice-candidate", {
            candidate: e.candidate,
            type: "receiver",
            roomId,
          });
        }
      };

      socket.emit("answer", {
        sdp,
        roomId,
      });

      setTimeout(() => {
        const track1 = pc.getTransceivers()[0].receiver.track;
        const track2 = pc.getTransceivers()[1].receiver.track;
        if (track1.kind === "video") {
          // @ts-ignore
          setRemoteAudioTrack(track2);
          setRemoteVideoTrack(track1);
        } else {
          setRemoteAudioTrack(track1);
          setRemoteVideoTrack(track2);
        }
        // @ts-ignore
        remoteVideoRef.current?.srcObject.addTrack(track1);
        // @ts-ignore
        remoteVideoRef.current?.srcObject.addTrack(track2);
        remoteVideoRef.current?.play();
        // const { track, type } = e;
        // if (type === "audio") {
        //   // setRemoteAudioTrack(track);
        //   // @ts-ignore
        //   remoteVideoRef.current?.srcObject.addTrack(track);
        // } else {
        //   // setRemoteVideoTrack(track);
        //   // @ts-ignore
        //   remoteVideoRef.current?.srcObject.addTrack(track);
        // }
        // // @ts-ignore
        // remoteVideoRef.current?.play();
      }, 5000);
    });

    socket.on("answer", ({ roomId, sdp: remoteSdp }) => {
      setLobby(false);
      // alert("Connection done");
      setSendingPc((pc) => {
        pc?.setRemoteDescription(remoteSdp);
        return pc;
      });
    });

    socket.on("lobby", () => {
      setLobby(true);
    });

    socket.on("add-ice-candidate", ({ candidate, type }) => {
      // if (type == "sender") {
      //   setReceivingPc((pc) => {
      //     pc?.addIceCandidate({ candidate });
      //     return pc;
      //   });
      // } else {
      //   setSendingPc((pc) => {
      //     pc?.addIceCandidate({ candidate });
      //     return pc;
      //   });
      // }
      if (type == "sender") {
        setReceivingPc((pc) => {
          if (!pc) {
            console.error("receicng pc nout found");
          } else {
            console.error(pc.ontrack);
          }
          pc?.addIceCandidate(candidate);
          return pc;
        });
      } else {
        setSendingPc((pc) => {
          if (!pc) {
            console.error("sending pc nout found");
          } else {
            // console.error(pc.ontrack)
          }
          pc?.addIceCandidate(candidate);
          return pc;
        });
      }
    });

    setSocket(socket);
  }, [name]);

  useEffect(() => {
    if (localVideoRef.current) {
      if (localVideoTrack) {
        localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
        localVideoRef.current.play();
      }
    }
  }, [localVideoRef]);

  return (
    <>
      <div>
        {`Hi ${name}`}
        <video autoPlay width={400} height={400} ref={localVideoRef} />
        {lobby ? "Waiting to connect you to someone" : null}
        <video autoPlay width={400} height={400} ref={remoteVideoRef} />
      </div>
    </>
  );
};
