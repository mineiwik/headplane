import {
  ListChecks,
  Network,
  Plus,
  Route,
  Server,
  Tag,
  Terminal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useMemo, useState } from "react";

import Button from "~/components/button";
import Input from "~/components/input";
import Notice from "~/components/notice";
import Select from "~/components/select";
import cn from "~/utils/cn";

import {
  type AclRule,
  type PolicyObject,
  type SshRule,
  aclToJson,
  parsePolicy,
  readAcls,
  readAutoApprovers,
  readSsh,
  readStringArrayMap,
  readStringMap,
  serializePolicy,
  setPolicyKey,
} from "../policy";

interface BuilderProps {
  isDisabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export default function Builder({ value, onChange, isDisabled }: BuilderProps) {
  const parsed = useMemo(() => parsePolicy(value), [value]);

  if ("error" in parsed) {
    return (
      <Notice title="Cannot open the visual editor" variant="warning">
        The policy could not be parsed: {parsed.error}. Fix it in the <strong>Edit file</strong>{" "}
        tab, then return here.
      </Notice>
    );
  }

  const data = parsed.data;
  const update = (next: PolicyObject) => onChange(serializePolicy(next));

  const groups = readStringArrayMap(data, "groups");
  const tagOwners = readStringArrayMap(data, "tagOwners");
  const hosts = readStringMap(data, "hosts");
  const acls = readAcls(data);
  const ssh = readSsh(data);
  const autoApprovers = readAutoApprovers(data);

  const groupNames = groups.map(([name]) => name);
  const tagNames = tagOwners.map(([name]) => name);
  const hostNames = hosts.map(([name]) => name);
  const owners = ["*", ...groupNames, ...tagNames];
  const sources = ["*", ...groupNames, ...tagNames, ...hostNames, "autogroup:member"];
  const destinations = ["*:*", ...tagNames, ...hostNames.map((h) => `${h}:*`)];

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-mist-500 dark:text-mist-400">
        Editing here reformats the policy and removes comments. Use the <strong>Edit file</strong>{" "}
        tab to keep them.
      </p>

      <Section
        icon={<Users className="h-4 w-4" />}
        title="Groups"
        description="Collections of users you can reference elsewhere."
        onAdd={() => update(setMap(data, "groups", [...groups, ["group:", []]]))}
        addLabel="Add group"
        disabled={isDisabled}
        empty={groups.length === 0}
      >
        {groups.map(([name, members], index) => (
          <Row key={index} onRemove={() => update(setMap(data, "groups", removeAt(groups, index)))}>
            <Input
              label="Name"
              placeholder="group:engineering"
              value={name}
              disabled={isDisabled}
              onChange={(v) =>
                update(setMap(data, "groups", replaceAt(groups, index, [v, members])))
              }
            />
            <ChipInput
              label="Members"
              placeholder="user@example.com"
              values={members}
              suggestions={groupNames}
              disabled={isDisabled}
              onChange={(v) => update(setMap(data, "groups", replaceAt(groups, index, [name, v])))}
            />
          </Row>
        ))}
      </Section>

      <Section
        icon={<Tag className="h-4 w-4" />}
        title="Tag owners"
        description="Who is allowed to assign each device tag."
        onAdd={() => update(setMap(data, "tagOwners", [...tagOwners, ["tag:", []]]))}
        addLabel="Add tag"
        disabled={isDisabled}
        empty={tagOwners.length === 0}
      >
        {tagOwners.map(([name, ownerList], index) => (
          <Row
            key={index}
            onRemove={() => update(setMap(data, "tagOwners", removeAt(tagOwners, index)))}
          >
            <Input
              label="Tag"
              placeholder="tag:server"
              value={name}
              disabled={isDisabled}
              onChange={(v) =>
                update(setMap(data, "tagOwners", replaceAt(tagOwners, index, [v, ownerList])))
              }
            />
            <ChipInput
              label="Owners"
              placeholder="group:admins"
              values={ownerList}
              suggestions={owners}
              disabled={isDisabled}
              onChange={(v) =>
                update(setMap(data, "tagOwners", replaceAt(tagOwners, index, [name, v])))
              }
            />
          </Row>
        ))}
      </Section>

      <Section
        icon={<Server className="h-4 w-4" />}
        title="Hosts"
        description="Named aliases for IP addresses or CIDR ranges."
        onAdd={() => update(setStringMap(data, "hosts", [...hosts, ["", ""]]))}
        addLabel="Add host"
        disabled={isDisabled}
        empty={hosts.length === 0}
      >
        {hosts.map(([name, cidr], index) => (
          <Row
            key={index}
            onRemove={() => update(setStringMap(data, "hosts", removeAt(hosts, index)))}
          >
            <Input
              label="Name"
              placeholder="internal-web"
              value={name}
              disabled={isDisabled}
              onChange={(v) =>
                update(setStringMap(data, "hosts", replaceAt(hosts, index, [v, cidr])))
              }
            />
            <Input
              label="CIDR"
              placeholder="10.0.0.1/32"
              value={cidr}
              disabled={isDisabled}
              onChange={(v) =>
                update(setStringMap(data, "hosts", replaceAt(hosts, index, [name, v])))
              }
            />
          </Row>
        ))}
      </Section>

      <Section
        icon={<ListChecks className="h-4 w-4" />}
        title="ACL rules"
        description="Allow traffic from sources to destinations. Rules are accept-only."
        onAdd={() =>
          update(
            setPolicyKey(
              data,
              "acls",
              [...acls, { action: "accept", src: [], dst: [] }].map(aclToJson),
            ),
          )
        }
        addLabel="Add rule"
        disabled={isDisabled}
        empty={acls.length === 0}
      >
        {acls.map((rule, index) => {
          const write = (next: AclRule) =>
            update(setPolicyKey(data, "acls", replaceAt(acls, index, next).map(aclToJson)));
          return (
            <Row
              key={index}
              onRemove={() =>
                update(setPolicyKey(data, "acls", removeAt(acls, index).map(aclToJson)))
              }
            >
              <ChipInput
                label="Source"
                placeholder="group:engineering"
                values={rule.src}
                suggestions={sources}
                disabled={isDisabled}
                onChange={(v) => write({ ...rule, src: v })}
              />
              <ChipInput
                label="Destination"
                placeholder="tag:server:22"
                values={rule.dst}
                suggestions={destinations}
                disabled={isDisabled}
                onChange={(v) => write({ ...rule, dst: v })}
              />
              <Input
                label="Protocol"
                description="Optional. e.g. tcp, udp, icmp."
                placeholder="any"
                value={rule.proto ?? ""}
                disabled={isDisabled}
                onChange={(v) => write({ ...rule, proto: v || undefined })}
              />
            </Row>
          );
        })}
      </Section>

      <Section
        icon={<Terminal className="h-4 w-4" />}
        title="SSH rules"
        description="Control Tailscale SSH access to tagged devices."
        onAdd={() =>
          update(
            setPolicyKey(data, "ssh", [...ssh, { action: "accept", src: [], dst: [], users: [] }]),
          )
        }
        addLabel="Add SSH rule"
        disabled={isDisabled}
        empty={ssh.length === 0}
      >
        {ssh.map((rule, index) => {
          const write = (next: SshRule) =>
            update(setPolicyKey(data, "ssh", replaceAt(ssh, index, next)));
          return (
            <Row
              key={index}
              onRemove={() => update(setPolicyKey(data, "ssh", removeAt(ssh, index)))}
            >
              <Select
                label="Action"
                items={[
                  { value: "accept", label: "accept" },
                  { value: "check", label: "check (re-auth)" },
                ]}
                value={rule.action}
                disabled={isDisabled}
                onValueChange={(v) => write({ ...rule, action: v ?? "accept" })}
              />
              <ChipInput
                label="Source"
                placeholder="group:admins"
                values={rule.src}
                suggestions={sources}
                disabled={isDisabled}
                onChange={(v) => write({ ...rule, src: v })}
              />
              <ChipInput
                label="Destination"
                placeholder="tag:server"
                values={rule.dst}
                suggestions={[...tagNames, "autogroup:self"]}
                disabled={isDisabled}
                onChange={(v) => write({ ...rule, dst: v })}
              />
              <ChipInput
                label="SSH users"
                placeholder="autogroup:nonroot"
                values={rule.users}
                suggestions={["autogroup:nonroot", "root"]}
                disabled={isDisabled}
                onChange={(v) => write({ ...rule, users: v })}
              />
            </Row>
          );
        })}
      </Section>

      <Section
        icon={<Route className="h-4 w-4" />}
        title="Auto approvers — routes"
        description="Advertised routes that are approved automatically."
        onAdd={() =>
          update(
            setAutoApprovers(data, {
              ...autoApprovers,
              routes: { ...autoApprovers.routes, "": [] },
            }),
          )
        }
        addLabel="Add route"
        disabled={isDisabled}
        empty={Object.keys(autoApprovers.routes).length === 0}
      >
        {Object.entries(autoApprovers.routes).map(([cidr, ownerList], index) => {
          const entries = Object.entries(autoApprovers.routes);
          return (
            <Row
              key={index}
              onRemove={() =>
                update(
                  setAutoApprovers(data, {
                    ...autoApprovers,
                    routes: Object.fromEntries(removeAt(entries, index)),
                  }),
                )
              }
            >
              <Input
                label="Route"
                placeholder="192.168.0.0/24"
                value={cidr}
                disabled={isDisabled}
                onChange={(v) =>
                  update(
                    setAutoApprovers(data, {
                      ...autoApprovers,
                      routes: Object.fromEntries(replaceAt(entries, index, [v, ownerList])),
                    }),
                  )
                }
              />
              <ChipInput
                label="Approvers"
                placeholder="tag:router"
                values={ownerList}
                suggestions={owners}
                disabled={isDisabled}
                onChange={(v) =>
                  update(
                    setAutoApprovers(data, {
                      ...autoApprovers,
                      routes: Object.fromEntries(replaceAt(entries, index, [cidr, v])),
                    }),
                  )
                }
              />
            </Row>
          );
        })}
      </Section>

      <Section
        icon={<Network className="h-4 w-4" />}
        title="Auto approvers — exit nodes"
        description="Owners whose devices become exit nodes automatically."
        disabled={isDisabled}
        empty={false}
      >
        <div className="p-4">
          <ChipInput
            label="Exit node approvers"
            labelHidden
            placeholder="tag:exit"
            values={autoApprovers.exitNode}
            suggestions={owners}
            disabled={isDisabled}
            onChange={(v) => update(setAutoApprovers(data, { ...autoApprovers, exitNode: v }))}
          />
        </div>
      </Section>
    </div>
  );
}

// ponytail: state is derived from the policy string each render, so two rows
// sharing a key (e.g. two blank rows) collapse to one. Fine for add-then-fill;
// hold local row state if simultaneous blank rows ever need to coexist.
function setMap(policy: PolicyObject, key: string, entries: [string, string[]][]): PolicyObject {
  return setPolicyKey(policy, key, Object.fromEntries(entries));
}

function setStringMap(
  policy: PolicyObject,
  key: string,
  entries: [string, string][],
): PolicyObject {
  return setPolicyKey(policy, key, Object.fromEntries(entries));
}

function setAutoApprovers(
  policy: PolicyObject,
  value: { routes: Record<string, string[]>; exitNode: string[] },
): PolicyObject {
  const cleaned: Record<string, unknown> = {};
  if (Object.keys(value.routes).length > 0) {
    cleaned.routes = value.routes;
  }
  if (value.exitNode.length > 0) {
    cleaned.exitNode = value.exitNode;
  }
  return setPolicyKey(policy, "autoApprovers", cleaned);
}

function replaceAt<T>(list: T[], index: number, item: T): T[] {
  const next = list.slice();
  next[index] = item;
  return next;
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

interface SectionProps {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  disabled?: boolean;
  empty: boolean;
}

function Section({
  icon,
  title,
  description,
  children,
  onAdd,
  addLabel,
  disabled,
  empty,
}: SectionProps) {
  return (
    <div className="rounded-lg border border-mist-200 dark:border-mist-800">
      <div className="flex items-center justify-between gap-4 border-b border-mist-200 p-4 dark:border-mist-800">
        <div className="flex items-center gap-2.5">
          <span className="text-mist-500 dark:text-mist-400">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-mist-500 dark:text-mist-400">{description}</p>
          </div>
        </div>
        {onAdd ? (
          <Button variant="ghost" onClick={onAdd} disabled={disabled}>
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>
      {empty && onAdd ? (
        <p className="p-4 text-sm text-mist-400 dark:text-mist-500">Nothing here yet.</p>
      ) : (
        children
      )}
    </div>
  );
}

function Row({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-mist-100 p-4 last:border-b-0 dark:border-mist-800/50">
      <div className="grid flex-1 gap-3 sm:grid-cols-2">{children}</div>
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className={cn(
          "mt-7 rounded-md p-2 text-mist-400",
          "hover:bg-red-50 hover:text-red-500",
          "dark:hover:bg-red-500/10",
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ChipInputProps {
  label: string;
  labelHidden?: boolean;
  placeholder?: string;
  values: string[];
  suggestions?: string[];
  disabled?: boolean;
  onChange: (values: string[]) => void;
}

function ChipInput({
  label,
  labelHidden,
  placeholder,
  values,
  suggestions,
  disabled,
  onChange,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="flex w-full flex-col gap-1">
      <span
        className={cn(
          "text-sm font-medium text-mist-700 dark:text-mist-200",
          labelHidden && "sr-only",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5",
          "border-mist-200 bg-white dark:border-mist-800 dark:bg-mist-900",
          "focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:ring-offset-1",
          "dark:focus-within:ring-indigo-400/40 dark:focus-within:ring-offset-mist-900",
          disabled && "opacity-50",
        )}
      >
        {values.map((chip) => (
          <span
            key={chip}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
              "bg-mist-100 text-mist-700 dark:bg-mist-700 dark:text-mist-100",
            )}
          >
            {chip}
            {!disabled ? (
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => onChange(values.filter((v) => v !== chip))}
                className="text-mist-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          value={draft}
          list={suggestions && suggestions.length > 0 ? listId : undefined}
          placeholder={values.length === 0 ? placeholder : undefined}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-hidden"
          data-1p-ignore
        />
        {suggestions && suggestions.length > 0 ? (
          <datalist id={listId}>
            {suggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  );
}
