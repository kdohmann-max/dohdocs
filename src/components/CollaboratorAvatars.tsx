import { useEffect, useState } from "react";
import type { SupabaseProvider } from "../collaboration/SupabaseProvider";

interface AwarenessUser {
  name: string;
  color: string;
}

interface Props {
  provider: SupabaseProvider;
  currentUserId: string;
}

export function CollaboratorAvatars({ provider }: Props) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    function update() {
      const states = provider.awareness.getStates();
      const list: AwarenessUser[] = [];
      states.forEach((state: Record<string, unknown>) => {
        if (state.user) list.push(state.user as AwarenessUser);
      });
      setUsers(list);
    }

    update();
    provider.awareness.on("change", update);
    return () => provider.awareness.off("change", update);
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="collab-avatars">
      {users.map((u, i) => (
        <div
          key={i}
          className="collab-avatar"
          style={{ background: u.color, borderColor: u.color }}
          title={u.name}
        >
          {u.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
