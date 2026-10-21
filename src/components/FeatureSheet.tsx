"use client";

import { LayoutGrid, MessageCircle, Plus, Users, X } from "lucide-react";
import LibraryPanel from "./panels/LibraryPanel";
import VisitorsPanel from "./panels/VisitorsPanel";
import ChatPanel from "./panels/ChatPanel";
import AddArtworkPanel from "./panels/AddArtworkPanel";
import type { ChatDTO, ExhibitDTO, Gender, PlayerDTO } from "@/lib/gallery";
import { Modal, Tabs, cx } from "./ui";

export type FeatureTab = "collection" | "add" | "visitors" | "chat";

type Props = {
  open: FeatureTab | null;
  onClose: () => void;
  onOpenTab: (tab: FeatureTab) => void;

  // collection
  exhibits: ExhibitDTO[];
  filtered: ExhibitDTO[];
  search: string;
  filter: "all" | "image" | "video";
  onSearch: (v: string) => void;
  onFilter: (v: "all" | "image" | "video") => void;
  onOpenExhibit: (ex: ExhibitDTO) => void;
  onVisit: (ex: ExhibitDTO) => void;
  onDelete: (ex: ExhibitDTO) => void;

  // visitors
  entered: boolean;
  room: string;
  me: { name: string; gender: Gender; color: string; hat: string };
  players: PlayerDTO[];
  guides: PlayerDTO[];
  guidesOn: boolean;
  joinCode: string;
  onJoinCode: (v: string) => void;
  onJoinRoom: () => void;
  onGoGrandHall: () => void;
  onTeleportTo: (x: number, z: number, rotY?: number) => void;
  onWave: () => void;
  onInvite: () => void;
  onToggleGuides: () => void;

  // chat
  messages: ChatDTO[];
  mySession: string;
  chatInput: string;
  onChatInput: (v: string) => void;
  onSendChat: (text: string) => void;
  unread: number;

  // add artwork
  artistFallback: string;
  form: { title: string; artist: string; year: string; description: string; url: string; mediaType: "image" | "video"; poster: string };
  uploading: boolean;
  saving: boolean;
  samples: Array<{ title: string; artist: string; mediaType: "image" | "video"; url: string }>;
  onFormChange: (patch: Partial<Props["form"]>) => void;
  onUpload: (file: File) => void;
  onSubmitArt: () => void;
  onPickSample: (s: { title: string; artist: string; mediaType: "image" | "video"; url: string }) => void;
};

const TITLES: Record<FeatureTab, string> = {
  collection: "The Collection",
  add: "Add Artwork",
  visitors: "Visitors",
  chat: "Room Chat",
};

export default function FeatureSheet(props: Props) {
  const { open, onClose, onOpenTab } = props;
  if (!open) return null;

  return (
    <Modal open={!!open} onClose={onClose} width="max-w-2xl" labelledBy="sheet-title">
      <div className="flex items-center justify-between border-b border-ink-200/70 px-5 py-4">
        <h2 id="sheet-title" className="display text-[20px] text-ink-950">
          {TITLES[open]}
        </h2>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 text-ink-500 transition hover:bg-ink-900 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Tabs
        value={open}
        onChange={onOpenTab}
        items={[
          { id: "collection", label: "Collection", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
          { id: "add", label: "Add art", icon: <Plus className="h-3.5 w-3.5" /> },
          { id: "visitors", label: "Visitors", icon: <Users className="h-3.5 w-3.5" />, count: props.players.length || undefined },
          { id: "chat", label: "Chat", icon: <MessageCircle className="h-3.5 w-3.5" />, count: props.unread || undefined },
        ]}
      />

      <div className="h-[62vh] max-h-[620px] bg-white">
        {open === "collection" && (
          <LibraryPanel
            exhibits={props.exhibits}
            filtered={props.filtered}
            search={props.search}
            filter={props.filter}
            onSearch={props.onSearch}
            onFilter={props.onFilter}
            onOpen={props.onOpenExhibit}
            onVisit={props.onVisit}
            onDelete={props.onDelete}
            onAdd={() => props.onOpenTab("add")}
          />
        )}
        {open === "visitors" && (
          <VisitorsPanel
            entered={props.entered}
            room={props.room}
            me={{ name: props.me.name, gender: props.me.gender, color: props.me.color, hat: props.me.hat }}
            players={props.players}
            bots={props.guides}
            botsOn={props.guidesOn}
            joinCode={props.joinCode}
            onJoinCode={props.onJoinCode}
            onJoinRoom={props.onJoinRoom}
            onGoGrandHall={props.onGoGrandHall}
            onTeleport={props.onTeleportTo}
            onWave={props.onWave}
            onInvite={props.onInvite}
            onToggleBots={props.onToggleGuides}
          />
        )}
        {open === "chat" && (
          <ChatPanel
            messages={props.messages}
            mySession={props.mySession}
            input={props.chatInput}
            onInput={props.onChatInput}
            onSend={props.onSendChat}
          />
        )}
        {open === "add" && (
          <AddArtworkPanel
            room={props.room}
            artistFallback={props.artistFallback}
            {...props.form}
            uploading={props.uploading}
            saving={props.saving}
            samples={props.samples}
            onChange={props.onFormChange}
            onUpload={props.onUpload}
            onSubmit={props.onSubmitArt}
            onPickSample={props.onPickSample}
          />
        )}
      </div>
    </Modal>
  );
}