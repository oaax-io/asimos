import "@livekit/components-styles";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

export default function VideoRoom({
  token,
  serverUrl,
  onLeave,
}: {
  token: string;
  serverUrl: string;
  onLeave: () => void;
}) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video
      audio
      data-lk-theme="default"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      onDisconnected={onLeave}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Stage />
      </div>
      {/* Chat bewusst deaktiviert – der CRM-Chat wird daneben genutzt */}
      <ControlBar
        controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true, settings: false }}
        variation="minimal"
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
