import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { query, where, getDocs, collection, doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const logoutBtn = document.getElementById("logout-btn");

// Kiểm tra trạng thái đăng nhập khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Truy vấn Firestore để tìm tài liệu của người dùng
        const usersRef = collection(db, "employees");
        const q = query(usersRef, where("userId", "==", user.uid)); // Truy vấn theo userId
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userRef = doc(db, "employees", userDoc.id);

          // Lấy thông tin username và name từ tài liệu Firestore
          const username = userDoc.data().username;
          const name = userDoc.data().name;

          // Hiển thị thông tin chào mừng
          document.getElementById("welcome-message").textContent = `Chào Mừng ${username} - ${name}`;

          // Cập nhật trạng thái online và thời gian hoạt động cuối cùng
          await updateDoc(userRef, {
            status: "online",
            lastActive: Timestamp.now(),
          });
        } else {
          console.error("User document not found in Firestore.");
        }
      } catch (error) {
        console.error("Error fetching user data or updating status:", error);
      }

      // Xử lý đăng xuất khi nhấn nút logout
      logoutBtn.addEventListener("click", async () => {
        const confirmLogout = confirm("Bạn có muốn đăng xuất không?");
        if (!confirmLogout) return;

        try {
          const q = query(collection(db, "employees"), where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userRef = doc(db, "employees", userDoc.id);
            await updateDoc(userRef, {
              status: "offline",
              lastActive: Timestamp.now(),
            });
          }
        } catch (error) {
          console.error("Error updating status during logout:", error);
        }

        // Đăng xuất người dùng
        signOut(auth)
          .then(() => {
            console.log("User logged out");
            localStorage.setItem("userLoggedIn", "false");
            window.location.href = "index.html"; // Chuyển hướng về trang index
          })
          .catch((error) => {
            console.error("Logout failed:", error.message);
          });
      });

      // Lắng nghe sự kiện tắt trình duyệt hoặc tab
      window.addEventListener("beforeunload", async () => {
        if (auth.currentUser) {
          try {
            const q = query(collection(db, "employees"), where("userId", "==", auth.currentUser.uid));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const userRef = doc(db, "employees", userDoc.id);

              // Cập nhật trạng thái thành offline
              await updateDoc(userRef, {
                status: "offline",
                lastActive: Timestamp.now(),
              });
            }
          } catch (error) {
            console.error("Error updating status during browser close:", error);
          }
        }
      });
    } else {
      // Nếu người dùng chưa đăng nhập, chuyển hướng đến trang đăng nhập
      alert("Please log in first.");
      window.location.href = "index.html";
    }
  });
});
