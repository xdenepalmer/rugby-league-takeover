import React from "react";
import UsersManager from "../UsersManager";
import UserInviteManager from "../UserInviteManager";
import BansManager from "../BansManager";

export default function PeoplePanel() {
  return (
    <div className="grid gap-8">
      <UsersManager />
      <UserInviteManager />
      <BansManager />
    </div>
  );
}
