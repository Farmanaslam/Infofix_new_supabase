import { auth, db } from "@/firebaseConfig";  // Your main auth/db
import {
  collection,
  setDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { SupabaseCustomer } from "@/types";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, initializeAuth } from "firebase/auth";
import { getApps, FirebaseApp, initializeApp } from "firebase/app"; 

// 👇 paste Supabase JSON here
const supabaseCustomers: SupabaseCustomer[] = [
  // Your full array here (unchanged)
  
  {
    "id": "CUST-009",
    "name": "sujal",
    "email": "sujal@infofix.com",
    "phone": "9749799039",
    "address": "ukhra",
    "created_at": "2025-12-01T13:15:51.504+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-011",
    "name": "Rahul",
    "email": "rahul@infofix.com",
    "phone": "7602321846",
    "address": "ukhra",
    "created_at": "2025-12-01T13:19:17.219+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-013",
    "name": "roshan",
    "email": "roshan@infofix.com",
    "phone": "8637310426",
    "address": "ukhra",
    "created_at": "2025-12-01T13:26:44.342+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-015",
    "name": "sandip",
    "email": "sandip@infofix.com",
    "phone": "8145584507",
    "address": "ukhra",
    "created_at": "2025-12-01T13:33:38.797+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-017",
    "name": "pappu",
    "email": "pappu@infofix.com",
    "phone": "7076036888",
    "address": "ukhra",
    "created_at": "2025-12-01T13:38:13.448+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-019",
    "name": "Ramasish",
    "email": "Ramasish@infofix.com",
    "phone": "973204726",
    "address": "ukhra",
    "created_at": "2025-12-02T08:53:57.63+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-021",
    "name": "Singh",
    "email": "Abhisek@infofix.com",
    "phone": "8700759742",
    "address": "ukhra",
    "created_at": "2025-12-02T09:04:36.293+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-044",
    "name": "subrata bauri",
    "email": "subrata@infofix.com",
    "phone": "7745859712",
    "address": "Ukhra",
    "created_at": "2025-12-15T08:42:20.353+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-022",
    "name": "ASANSOL SHOP",
    "email": "asansolshop@infofix.com",
    "phone": "8670777086",
    "address": "ASANSOL",
    "created_at": "2025-12-02T13:36:00.751+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-024",
    "name": "Sumit Kumar Senapati",
    "email": "Sumit@infofix.com",
    "phone": "8391995501",
    "address": "Durgapur",
    "created_at": "2025-12-04T07:26:05.4+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-026",
    "name": "Ganesh Paswan",
    "email": "Ganesh@infofix.com",
    "phone": "8768030531",
    "address": "Ukhra",
    "created_at": "2025-12-04T09:44:51.538+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-028",
    "name": "Subhajit Gorai",
    "email": "Subhajit@infofix.com",
    "phone": "7679707025",
    "address": "Durgapur",
    "created_at": "2025-12-05T07:23:22.592+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-030",
    "name": "Sayan Ghosh",
    "email": "Sayan@infofix.com",
    "phone": "7076069753",
    "address": "Durgapur",
    "created_at": "2025-12-07T07:12:17.89+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-032",
    "name": "Dara Singh",
    "email": "Dara@infofix.com",
    "phone": "6295478388",
    "address": "Durgapur",
    "created_at": "2025-12-07T07:26:43.925+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-034",
    "name": "INFOFIX ASANSOL",
    "email": "infofixcomputerssales7@gmail.com",
    "phone": "08670777086",
    "address": "ASHRAM MORE,ASNSOL-713303",
    "created_at": "2025-12-08T11:05:25.66+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-036",
    "name": "Arif",
    "email": "hussainarif7374@gmail.com",
    "phone": "8016908227",
    "address": "Durgapur",
    "created_at": "2025-12-09T07:49:07.978+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-038",
    "name": "DURGAPUR",
    "email": "DURGAPUR@INFOFIX.COM",
    "phone": "9382979780",
    "address": "Durgapur",
    "created_at": "2025-12-10T10:44:37.597+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-040",
    "name": "ShreeJi Foods & packing",
    "email": "kkmisra21@gmail.com",
    "phone": "8777643880",
    "address": "Raniganj",
    "created_at": "2025-12-11T08:57:48.763+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-042",
    "name": "Prabhu Dayal",
    "email": "prabhudayalghosal87@gmail.com",
    "phone": "7477370425",
    "address": "Andal",
    "created_at": "2025-12-14T06:01:08.692+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-046",
    "name": "Ukhra",
    "email": "ukhra@infofix.com",
    "phone": "7318621222",
    "address": "ukhra",
    "created_at": "2025-12-15T13:05:09.2+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-048",
    "name": "sribash das",
    "email": "xyz@gmail.com",
    "phone": "6296104903",
    "address": "abcd",
    "created_at": "2025-12-17T05:14:29.633+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-050",
    "name": "Subhasis Mondal (ukhra)",
    "email": "subhasis@infofix.com",
    "phone": "9635175403",
    "address": "Ukhra",
    "created_at": "2025-12-17T07:13:44.554+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-052",
    "name": "Sourav Mondal (ukhra)",
    "email": "sourav@infofix.com",
    "phone": "8670537642",
    "address": "Ukhra",
    "created_at": "2025-12-17T07:18:03.026+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-054",
    "name": "SMIT SHARMA",
    "email": "0",
    "phone": "9832564108",
    "address": "ASANSOL",
    "created_at": "2025-12-17T09:46:38.185+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-056",
    "name": "Bappa",
    "email": "Bappa@infofix.com",
    "phone": "9749034491",
    "address": "Durgapur",
    "created_at": "2025-12-17T10:21:25.284+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-058",
    "name": "ASHU BARNWAL",
    "email": "ASHU BARNWAL",
    "phone": "9832687877",
    "address": "ASANSOL",
    "created_at": "2025-12-18T10:45:02.62+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-060",
    "name": "Dipen Ruidas (ukhra)",
    "email": "dipen@infofix.com",
    "phone": "8637093585",
    "address": "Ukhra",
    "created_at": "2025-12-19T06:25:37.867+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-062",
    "name": "ArkaPal Halder",
    "email": "arkapalhalder@gmail.com",
    "phone": "9339429842",
    "address": "Durgapur",
    "created_at": "2025-12-21T06:20:25.752+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-064",
    "name": "Subhadip Chel",
    "email": "subhadip@outlook.com",
    "phone": "8944812978",
    "address": "Bankura",
    "created_at": "2025-12-21T07:11:54.009+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-066",
    "name": "Sunayan Sharma",
    "email": "sunayana@infofix.com",
    "phone": "9064902171",
    "address": "Durgapur",
    "created_at": "2025-12-21T07:21:55.119+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-068",
    "name": "ADIBA FIROJ",
    "email": "ADIBA FIROJ",
    "phone": "9091610313",
    "address": "ASANSOL",
    "created_at": "2025-12-22T10:43:17.142+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-070",
    "name": "INFOFIX ASANSOL",
    "email": "INFOFIX ASANSOL",
    "phone": "8670777086",
    "address": "ASANSOL",
    "created_at": "2025-12-22T10:47:40.449+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-072",
    "name": "Yogendra Shah (ukhra)",
    "email": "yogendra@infofix.com",
    "phone": "9232683260",
    "address": "Ukhra",
    "created_at": "2025-12-23T11:33:35.473+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-074",
    "name": "Amir Sohali(ukhra)",
    "email": "amir@infofix.com",
    "phone": "9563532419",
    "address": "Ukhra",
    "created_at": "2025-12-26T09:13:58.202+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-076",
    "name": "Kalyan Mondal(ukhra)",
    "email": "kalyan@infofix.com",
    "phone": "9933885317",
    "address": "Ukhra",
    "created_at": "2025-12-26T09:19:00.5+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-010",
    "name": "uttam",
    "email": "uttam@infofix.com",
    "phone": "9382518914",
    "address": "ukhra",
    "created_at": "2025-12-01T13:18:11.441+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-014",
    "name": "rupam",
    "email": "rupam@infofix.com",
    "phone": "9083214244",
    "address": "ukhra",
    "created_at": "2025-12-01T13:27:43.614+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-016",
    "name": "anil",
    "email": "anil@infofix.com",
    "phone": "9002997599",
    "address": "ukhra",
    "created_at": "2025-12-01T13:35:28.226+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-001",
    "name": "MOHIT BAURI",
    "email": "NA",
    "phone": "7047234835",
    "address": "GARUI",
    "created_at": "2025-12-01T07:21:40.76+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-003",
    "name": "ANAND SINGH",
    "email": "anandsingh",
    "phone": "9382764743",
    "address": "Budha More",
    "created_at": "2025-12-01T11:13:10.07+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-004",
    "name": "SONU HARI",
    "email": "sonuhari ",
    "phone": "7584824749",
    "address": "Asansol ",
    "created_at": "2025-12-01T11:21:39.674+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-005",
    "name": "Swarnarayan Ganguly ",
    "email": "swarnarayan",
    "phone": "7098250277",
    "address": "Asansol ",
    "created_at": "2025-12-01T11:30:48.407+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-006",
    "name": "Suman",
    "email": "suman@infofix.com",
    "phone": "9749705222",
    "address": "Durgapur",
    "created_at": "2025-12-01T12:13:58.408+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-007",
    "name": "Kaustav SArkar",
    "email": "kaustav",
    "phone": "9593768669",
    "address": "Durgapur",
    "created_at": "2025-12-01T12:22:40.023+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-043",
    "name": "Avinash Shaw",
    "email": "avinash@infofix.com",
    "phone": "9635455086",
    "address": "Durgapur",
    "created_at": "2025-12-14T06:13:16.192+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-045",
    "name": "lucky",
    "email": "lucky@infofix.com",
    "phone": "7909170468",
    "address": "Ukhra",
    "created_at": "2025-12-15T08:44:45.897+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-002",
    "name": "ASANSOL SHOP",
    "email": "asansol@infofix.com",
    "phone": "8670777086",
    "address": "ASHRAM MORE,ASNSOL-713303",
    "created_at": "2025-12-01T07:23:09.6+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-018",
    "name": "Roni Banerjee",
    "email": "Roni@infofix.com",
    "phone": "9476332695",
    "address": "Durgapur",
    "created_at": "2025-12-02T07:23:38.035+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-020",
    "name": "konkona",
    "email": "Konkona@infofix.com",
    "phone": "7047183800",
    "address": "ukhra",
    "created_at": "2025-12-02T08:56:13.294+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-047",
    "name": "Md. Noor",
    "email": "nmd771868@gmail.com",
    "phone": "8976527745",
    "address": "Durgapur",
    "created_at": "2025-12-16T12:30:38.455+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-049",
    "name": "Niraj Kumar (ukhra)",
    "email": "niraj@infofix.com",
    "phone": "9064183301",
    "address": "Ukhra",
    "created_at": "2025-12-17T07:11:22.776+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-051",
    "name": "Bikash Sen (ukhra)",
    "email": "bikash@infofix.com",
    "phone": "8617804930",
    "address": "Ukhra",
    "created_at": "2025-12-17T07:15:54.866+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-053",
    "name": "Farman",
    "email": "temp@gmail.com",
    "phone": "7477347818",
    "address": "Asansol",
    "created_at": "2025-12-17T09:28:49.494+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-055",
    "name": "INFOFIX ASANSOL",
    "email": "INFOFIX COMPUTER ASANSOL",
    "phone": "08670777086",
    "address": "ASHRAM MORE,ASNSOL-713303",
    "created_at": "2025-12-17T09:49:11.603+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-023",
    "name": "Kishore",
    "email": "Kishore@infofix.com",
    "phone": "8826878284",
    "address": "Durgapur",
    "created_at": "2025-12-04T06:06:02.693+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-025",
    "name": "Md Ali",
    "email": "Mdali@infofix.com",
    "phone": "6296079164",
    "address": "ukhra",
    "created_at": "2025-12-04T09:41:14.961+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-029",
    "name": "Sohail",
    "email": "Sohail@infofix.com",
    "phone": "9907710425",
    "address": "Ukhra",
    "created_at": "2025-12-05T10:47:53.278+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-031",
    "name": "Subham Chowdhury",
    "email": "Subham@infofix.com",
    "phone": "8514953937",
    "address": "Durgapur",
    "created_at": "2025-12-07T07:14:23.246+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-027",
    "name": "Pijush Pal",
    "email": "Pijush@infofix.com",
    "phone": "8250727328",
    "address": "Ukhra",
    "created_at": "2025-12-04T09:48:48.046+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-012",
    "name": "nanik",
    "email": "nanik@infofix.com",
    "phone": "9333131374",
    "address": "ukhra",
    "created_at": "2025-12-01T13:21:44.117+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-033",
    "name": "Abhijit Dutta",
    "email": "Abhijit@infofix.com",
    "phone": "7384151192",
    "address": "Durgapur",
    "created_at": "2025-12-07T07:40:55.116+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-035",
    "name": "sribash",
    "email": "SRIBASHDAS@gmail.com",
    "phone": "6296104903",
    "address": "durgapur",
    "created_at": "2025-12-08T12:42:43.834+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-037",
    "name": "SANTOSH",
    "email": "SANTOSH@INFOFIX.COM",
    "phone": "9932839015",
    "address": "DURGAPUR",
    "created_at": "2025-12-10T10:42:10.949+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-039",
    "name": "BISWAJIT",
    "email": "BISWAJIT@INFOFIX.COM",
    "phone": "7319319950",
    "address": "Durgapur",
    "created_at": "2025-12-10T11:01:30.797+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-041",
    "name": "Chouhan ",
    "email": "Chouhan@infofix.com",
    "phone": "7908934016",
    "address": "Ukhra",
    "created_at": "2025-12-13T07:02:42.275+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-057",
    "name": "KHUSHI",
    "email": "KHUSHIDGR0@GMAIL.COM",
    "phone": "8293578583",
    "address": "Durgapur",
    "created_at": "2025-12-18T08:42:12.548+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-059",
    "name": "Amar Kumar",
    "email": "AmarKumar@infofix.com",
    "phone": "7679052065",
    "address": "Durgapur",
    "created_at": "2025-12-19T05:42:22.612+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-061",
    "name": "Chandu Prasad (ukhra)",
    "email": "chandu@infofix.com",
    "phone": "94563866531",
    "address": "Ukhra",
    "created_at": "2025-12-19T06:28:21.802+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-063",
    "name": "Biswarup Chakraborty",
    "email": "Biswarup@infofix.com",
    "phone": "8373014372",
    "address": "Durgapur",
    "created_at": "2025-12-21T06:41:14.023+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-065",
    "name": "Saiyed Abu Intiaj",
    "email": "saiyed@infofix.com",
    "phone": "9153927226",
    "address": "",
    "created_at": "2025-12-21T07:14:27.175+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-067",
    "name": "Deep Pal",
    "email": "Deeppal@infofix.com",
    "phone": "8327682888",
    "address": "Andal",
    "created_at": "2025-12-21T12:17:12.447+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-069",
    "name": "SAFIQ ALI",
    "email": "SAFIQ ALI",
    "phone": "8637389853",
    "address": "ASANSOL",
    "created_at": "2025-12-22T10:45:41.101+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-071",
    "name": "Shrish Goswami (ukhra)",
    "email": "shrish@infofix.com",
    "phone": "7363948791",
    "address": "Ukhra",
    "created_at": "2025-12-23T11:29:22.189+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-073",
    "name": "Abhisek Kumer Singh(ukhra)",
    "email": "abhisek@infofix.com",
    "phone": "8700759742",
    "address": "Ukhra",
    "created_at": "2025-12-24T11:21:57.508+00:00",
    "notes": [],
    "photo_url": null
  },
  {
    "id": "CUST-075",
    "name": "Akash Dhibar(ukhra)",
    "email": "akash@infofix.com",
    "phone": "9641399211",
    "address": "Ukhra",
    "created_at": "2025-12-26T09:16:39.756+00:00",
    "notes": [],
    "photo_url": null
  },
    {
        "id": "CUST-077",
        "name": "Krishna Mondal(ukhra)",
        "email": "krishna@infofix.com",
        "phone": "7501993460",
        "address": "Ukhra",
        "created_at": "2025-12-26T09:27:39.609+00:00",
        "notes": [],
        "photo_url": null
    }
]
;

// Helper: Create a temp Firebase app for migration (to avoid affecting main auth)
function getTempAuth(): any {
  const apps = getApps();
  let tempApp: FirebaseApp;
  if (apps.length > 1) {
    tempApp = apps[1];  // Reuse if exists
  } else {
    // Use your Firebase config (same as main app)
    const firebaseConfig = {
      apiKey: "AIzaSyCJ5ZbxyToHBaaGvBrqkdlGDe1Ok4WvSnc",  // Or your config vars
      authDomain: "infofix-app.firebaseapp.com",
      projectId:"infofix-app",
      // Add other config as needed
    };
    tempApp = initializeApp(firebaseConfig, "temp-migration");
  }
  return initializeAuth(tempApp);
}

export async function importCustomersToFirestore() {
  const customersRef = collection(db, "customers");
  const tempAuth = getTempAuth();  // Temp auth for safe sign-in
  let createdCount = 0;
  let linkedCount = 0;
  let skippedCount = 0;

  for (const customer of supabaseCustomers) {
    const email = customer.email?.trim();
    const mobile = customer.phone?.trim();

    console.log(`🔍 Processing: ${email || 'No Email'} | Mobile: ${mobile}`);

    if (!mobile || mobile.length < 6) {
      console.log(`⏭️ Skipping invalid mobile: ${mobile}`);
      skippedCount++;
      continue;
    }

    const validEmail = email && email.includes("@") ? email.toLowerCase() : `${mobile}@temp.customer`;

    let authUid: string | null = null;

    // 🔹 1. Try to create Auth user (for new users)
    try {
      const userCred = await createUserWithEmailAndPassword(auth, validEmail, mobile);
      authUid = userCred.user.uid;
      console.log(`✅ Auth created: ${validEmail} (UID: ${authUid})`);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        console.log(`⚠️ Auth user exists, trying to link Firestore: ${validEmail}`);
        // 🔹 2. For existing users: Sign in with temp auth to get UID
        try {
          const userCred = await signInWithEmailAndPassword(tempAuth, validEmail, mobile);
          authUid = userCred.user.uid;
          await signOut(tempAuth);  // Sign out immediately
          console.log(`✅ Got UID for existing user: ${validEmail} (UID: ${authUid})`);
        } catch (signInError: any) {
          console.log(`❌ Could not sign in existing user ${validEmail}: ${signInError.message}`);
          skippedCount++;
          continue;
        }
      } else {
        console.log(`❌ Auth creation failed for ${validEmail}: ${error.message}`);
        skippedCount++;
        continue;
      }
    }

    // 🔹 3. Check if Firestore doc already exists (by mobile)
    try {
      const q = query(customersRef, where("mobile", "==", mobile));
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`⚠️ Firestore doc already exists for mobile ${mobile}, skipping`);
        skippedCount++;
        continue;
      }
    } catch (error: any) {
      console.log(`❌ Firestore check failed for ${validEmail}: ${error.message}`);
      skippedCount++;
      continue;
    }

    // 🔹 4. Add to Firestore using UID
    if (authUid) {
      try {
        await setDoc(doc(db, "customers", authUid), {
          name: customer.name || "",
          email: validEmail,
          mobile,
          address: customer.address || "",
          createdAt: serverTimestamp(),
          source: "supabase",
          role: "CUSTOMER",
        });
        console.log(`✅ Firestore added/linked: ${validEmail}`);
        if (authUid) linkedCount++;  // Count as linked for existing users
        createdCount++;
      } catch (error: any) {
        console.log(`❌ Firestore failed for ${validEmail}: ${error.message}`);
        skippedCount++;
      }
    }
  }

  console.log(`🎉 Import complete. Created/Linked: ${createdCount}, Skipped: ${skippedCount}`);
}