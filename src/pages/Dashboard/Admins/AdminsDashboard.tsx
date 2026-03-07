import { useContext, useEffect, useState } from "react";
import AppContext from "../../../contexts/appContext";
import styles from "./AdminsDashboard.module.css";
import MapComponent from "./MapComponent";

import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { calculateDistance, checkAuth } from "../../utils";
import Navbar from "../../../components/Navbar/Navbar";
import ReactTimeAgo from "react-time-ago";

const AdminsDashboard = () => {
  const { supabase } = useContext(AppContext);
  const { room_code } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [usersLocation, setUsersLocation] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<[number, number] | null>(null);

  /* =============================
     GET ADMIN GEOLOCATION
  ============================== */
  useEffect(() => {
    checkAuth({ navigate, toast });

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  /* =============================
     FETCH USER LOCATIONS
  ============================== */
  const getUserLocation = async (userIds: string[]) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("user_location")
      .select("*")
      .in("user_id", userIds);

    if (error) {
      toast.error("Error fetching user location");
      return;
    }

    setUsersLocation(data || []);
  };

  /* =============================
     FETCH USERS + LOCATIONS
  ============================== */
  const fetchUsersAndLocations = async (roomId: string) => {
    if (!supabase) return;

    const { data: memberData, error: memberError } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId);

    if (memberError) {
      toast.error("Error fetching room members");
      return;
    }

    const userIds = memberData.map((member) => member.user_id);

    await getUserLocation(userIds);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .in("id", userIds);

    if (userError) {
      toast.error("Error fetching users");
      return;
    }

    setUsers(userData || []);
  };

  /* =============================
     ROOM INIT + REALTIME
  ============================== */
  useEffect(() => {
    if (!supabase) return;

    let memberSubscription: any;

    const fetchData = async () => {
      const { data: roomData, error } = await supabase
        .from("rooms")
        .select("id")
        .eq("room_code", room_code)
        .single();

      if (error) {
        toast.error("Room not found");
        navigate("/");
        return;
      }

      const roomId = roomData.id;

      await fetchUsersAndLocations(roomId);

      memberSubscription = supabase
        .channel(`room_members:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_members",
            filter: `room_id=eq.${roomId}`,
          },
          async () => {
            await fetchUsersAndLocations(roomId);
            new Audio("/ting.mp3").play();
          }
        )
        .subscribe();
    };

    fetchData();

    return () => {
      if (memberSubscription) memberSubscription.unsubscribe();
    };
  }, [room_code, supabase]);

  /* =============================
     FORMAT DATA FOR GOOGLE MAP
  ============================== */
  const formattedUsersLocation =
    usersLocation.length && users.length
      ? usersLocation
          .map((location) => {
            const user = users.find((u) => u.id === location.user_id);
            if (!user) return null;

            return {
              id: user.id,
              latitude: location.latitude,
              longitude: location.longitude,
              email: user.email,
            };
          })
          .filter(Boolean)
      : [];

  const handleRefresh = () => {
    const userIds = users.map((user) => user.id);
    getUserLocation(userIds);
    toast.success("Data refreshed");
  };

  return (
    <div className={styles.adminDashboardContainer}>
      <Navbar />

      <div className={styles.dashboard}>
        <div className={styles.leftSideContainer}>
          <div className={styles.roomInformation}>
            <div className={styles.roomHeading}>
              <p className={styles.roomName}>Room Name</p>
              <p className={styles.roomCode}>{room_code}</p>
            </div>

            <div className={styles.roomDetails}>
              <p>{users.length} Members</p>
            </div>
          </div>

          <div className={styles.nearbyStudentContainer}>
            <div className={styles.nearbyHeading}>
              <div>
                <p className={styles.nearByStudents}>Nearby Students</p>
                <p className={styles.nearBySubText}>
                  list of students near you
                </p>
              </div>

              <button
                className={styles.refreshButton}
                onClick={handleRefresh}
              >
                Refresh
              </button>
            </div>

            <input
              type="text"
              placeholder="Search"
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.nearbyStudentList}>
              {users
                .filter(
                  (user) =>
                    user.email
                      .toLowerCase()
                      .includes(search.toLowerCase()) ||
                    user.name
                      .toLowerCase()
                      .includes(search.toLowerCase())
                )
                .map((user) => {
                  const location = usersLocation.find(
                    (loc) => loc.user_id === user.id
                  );

                  return (
                    <div
                      key={user.id}
                      className={styles.nearbyStudent}
                    >
                      <div>
                        <p>{user.name}</p>
                        <p>{user.email}</p>
                        <p>{user.phone}</p>
                      </div>

                      {location && position && (
                        <div>
                          <p>
                            <ReactTimeAgo
                              date={location.updated_at}
                              locale="en-US"
                            />
                          </p>

                          <p>
                            {calculateDistance(
                              {
                                latitude: position[0],
                                longitude: position[1],
                              },
                              {
                                latitude: location.latitude,
                                longitude: location.longitude,
                              }
                            ).toFixed(2)}{" "}
                            meters
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* GOOGLE MAP */}
        <div className={styles.mapContainer}>
          <MapComponent
            usersLocation={formattedUsersLocation}
            position={position}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminsDashboard;