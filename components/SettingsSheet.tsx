"use client";

import { useState, useTransition } from "react";
import {
  addMemberAction,
  changeMyPinAction,
  makeAdminAction,
  removeMemberAction,
  renameGroupAction,
  resetMemberPinAction,
  updateMemberAction,
} from "@/app/actions";
import { EMOJI_SUGGESTIONS, MAX_MEMBERS, colorOf, isValidPin, nextFreeColor } from "@/lib/members";
import type { ActionResult, Member } from "@/lib/types";
import ConfirmSheet from "./ConfirmSheet";
import MemberAvatarPicker from "./MemberAvatarPicker";

type Props = {
  me: Member;
  members: Member[];
  groupName: string;
  onClose: () => void;
  onToast: (msg: string) => void;
};

const field =
  "w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-base ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:ring-white/10";
const primary =
  "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50";
const section = "space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10";
const pinInput = (v: string, set: (v: string) => void, label: string) => (
  <input
    value={v}
    onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
    inputMode="numeric"
    type="password"
    autoComplete="off"
    placeholder={label}
    aria-label={label}
    className={`${field} text-center tracking-[0.4em]`}
  />
);

/** Runs an action, shows its outcome, and reports whether it worked. */
function useAction(onToast: (msg: string) => void) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        onToast(success);
        after?.();
      } else onToast(res.error);
    });
  return { pending, run };
}

export default function SettingsSheet({ me, members, groupName, onClose, onToast }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="animate-sheet safe-bottom flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-zinc-100 shadow-2xl dark:bg-zinc-950 sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-lg font-bold">⚙️ Settings</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-zinc-200 px-3 py-1.5 text-sm font-semibold dark:bg-zinc-800">
            Done
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <MyProfile me={me} onToast={onToast} />
          <ChangePin me={me} onToast={onToast} />
          {me.isAdmin ? (
            <>
              <GroupName groupName={groupName} onToast={onToast} />
              <ManageMembers me={me} members={members} onToast={onToast} />
            </>
          ) : (
            <p className="px-2 text-xs text-zinc-500">
              Need to add someone, reset a PIN or rename the group? Ask the admin (
              {members.find((m) => m.isAdmin)?.name ?? "admin"}).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MyProfile({ me, onToast }: { me: Member; onToast: (m: string) => void }) {
  const [name, setName] = useState(me.name);
  const [emoji, setEmoji] = useState(me.emoji);
  const [color, setColor] = useState(me.color);
  const { pending, run } = useAction(onToast);
  const dirty = name !== me.name || emoji !== me.emoji || color !== me.color;
  return (
    <section className={section}>
      <h3 className="text-sm font-bold">My profile</h3>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="My name" className={field} />
      <MemberAvatarPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={() => run(() => updateMemberAction(me.id, { name, emoji, color }), "Profile updated ✨")}
        className={primary}
      >
        Save profile
      </button>
    </section>
  );
}

function ChangePin({ me, onToast }: { me: Member; onToast: (m: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { pending, run } = useAction(onToast);
  const mismatch = confirm.length === 4 && next !== confirm;
  return (
    <section className={section}>
      <h3 className="text-sm font-bold">Change my PIN {me.pinIsDefault && <span className="text-amber-600">· still the default</span>}</h3>
      <div className="grid grid-cols-3 gap-2">
        {pinInput(current, setCurrent, "Current")}
        {pinInput(next, setNext, "New")}
        {pinInput(confirm, setConfirm, "Repeat")}
      </div>
      {mismatch && <p className="text-xs text-red-600">The new PINs don&apos;t match.</p>}
      <button
        type="button"
        disabled={pending || !isValidPin(current) || !isValidPin(next) || next !== confirm}
        onClick={() =>
          run(() => changeMyPinAction(current, next), "PIN changed 🔐", () => {
            setCurrent("");
            setNext("");
            setConfirm("");
          })
        }
        className={primary}
      >
        Change PIN
      </button>
    </section>
  );
}

function GroupName({ groupName, onToast }: { groupName: string; onToast: (m: string) => void }) {
  const [name, setName] = useState(groupName);
  const { pending, run } = useAction(onToast);
  return (
    <section className={section}>
      <h3 className="text-sm font-bold">Group name <span className="font-normal text-zinc-500">· admin</span></h3>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Group name" className={field} />
        <button
          type="button"
          disabled={pending || !name.trim() || name === groupName}
          onClick={() => run(() => renameGroupAction(name), "Group renamed")}
          className={primary}
        >
          Save
        </button>
      </div>
    </section>
  );
}

function ManageMembers({ me, members, onToast }: { me: Member; members: Member[]; onToast: (m: string) => void }) {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <section className={section}>
      <h3 className="text-sm font-bold">
        People ({members.length}/{MAX_MEMBERS}) <span className="font-normal text-zinc-500">· admin</span>
      </h3>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setOpenId(openId === m.id ? null : m.id)}
              className="flex w-full items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-left dark:bg-zinc-800"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${colorOf(m.color).bar}`} />
              <span className="text-xl">{m.emoji}</span>
              <span className="flex-1 truncate font-semibold">
                {m.name} {m.id === me.id && <span className="text-xs font-normal text-zinc-500">(you)</span>}
              </span>
              {m.isAdmin && <span className="text-[10px] font-bold uppercase text-emerald-600">Admin</span>}
              <span className="text-zinc-400">{openId === m.id ? "▴" : "▾"}</span>
            </button>
            {openId === m.id && m.id !== me.id && (
              <MemberAdmin key={`${m.id}-${m.name}-${m.emoji}-${m.color}`} member={m} onToast={onToast} onRemoved={() => setOpenId(null)} />
            )}
            {openId === m.id && m.id === me.id && (
              <p className="px-3 pt-2 text-xs text-zinc-500">Edit yourself under “My profile” above.</p>
            )}
          </li>
        ))}
      </ul>
      {members.length < MAX_MEMBERS && <AddMember members={members} onToast={onToast} />}
    </section>
  );
}

function MemberAdmin({ member, onToast, onRemoved }: { member: Member; onToast: (m: string) => void; onRemoved: () => void }) {
  const [name, setName] = useState(member.name);
  const [emoji, setEmoji] = useState(member.emoji);
  const [color, setColor] = useState(member.color);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState<"remove" | "admin" | null>(null);
  const { pending, run } = useAction(onToast);
  const dirty = name !== member.name || emoji !== member.emoji || color !== member.color;

  return (
    <div className="space-y-3 px-1 pb-1 pt-3">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label={`${member.name}'s name`} className={field} />
      <MemberAvatarPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={() => run(() => updateMemberAction(member.id, { name, emoji, color }), `${name} updated`)}
        className={primary}
      >
        Save changes
      </button>

      <div className="flex gap-2">
        {pinInput(pin, setPin, "New PIN")}
        <button
          type="button"
          disabled={pending || !isValidPin(pin)}
          onClick={() => run(() => resetMemberPinAction(member.id, pin), `${member.name}'s PIN reset — tell them the new one`, () => setPin(""))}
          className={`${primary} shrink-0`}
        >
          Reset PIN
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConfirm("admin")}
          className="rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold dark:bg-zinc-800"
        >
          👑 Make admin
        </button>
        <button
          type="button"
          onClick={() => setConfirm("remove")}
          className="rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-600 dark:bg-red-950/40"
        >
          Remove
        </button>
      </div>

      {confirm === "remove" && (
        <ConfirmSheet
          title={`Remove ${member.name}?`}
          body={`Their boxes, ticks and bucket list will be deleted for good.`}
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            run(() => removeMemberAction(member.id), `${member.name} removed`, onRemoved);
          }}
        />
      )}
      {confirm === "admin" && (
        <ConfirmSheet
          title={`Make ${member.name} the admin?`}
          body="There's one admin at a time — you'll become a regular member."
          confirmLabel="Hand over"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            run(() => makeAdminAction(member.id), `${member.name} is now the admin`);
          }}
        />
      )}
    </div>
  );
}

function AddMember({ members, onToast }: { members: Member[]; onToast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_SUGGESTIONS[members.length % EMOJI_SUGGESTIONS.length]);
  const [color, setColor] = useState<string>(nextFreeColor(members.map((m) => m.color)));
  const [pin, setPin] = useState("");
  const { pending, run } = useAction(onToast);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-zinc-300 py-2.5 text-sm font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
      >
        + Add a person
      </button>
    );

  return (
    <div className="space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Name" aria-label="New person's name" className={field} />
        {pinInput(pin, setPin, "PIN")}
      </div>
      <MemberAvatarPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
      <p className="text-xs text-zinc-500">They&apos;ll get their own boxes on the current plan straight away.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-zinc-200 px-4 py-2.5 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !name.trim() || !isValidPin(pin)}
          onClick={() =>
            run(() => addMemberAction({ name, emoji, color, pin }), `${name.trim()} joined 🎉`, () => {
              setOpen(false);
              setName("");
              setPin("");
            })
          }
          className={`${primary} flex-1`}
        >
          Add {name.trim() || "person"}
        </button>
      </div>
    </div>
  );
}
