import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.8/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/9.6.8/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.8/firebase-auth.js";

// Firebase Configuration
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('incidentForm');

// Hàm định dạng ngày thành DD/MM/YYYY HH:mm:ss
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Hàm lấy thông tin user từ Collection employees
async function getUserInfo(uid) {
    const employeesCollection = collection(db, "employees");
    const q = query(employeesCollection, where("userId", "==", uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        return `${userData.username} - ${userData.name}`;
    }
    throw new Error("Không tìm thấy thông tin người dùng.");
}

// Hàm tạo mã ticket tự động (ticket và ticketNumber)
async function generateTicketNumber() {
    const ticketCollection = collection(db, "incidentReports");
    const q = query(ticketCollection, orderBy("ticketNumber", "desc"), limit(1));
    const querySnapshot = await getDocs(q);

    let newTicketNumber = 1; // Mặc định nếu không có ticket
    if (!querySnapshot.empty) {
        const lastTicketData = querySnapshot.docs[0].data();
        newTicketNumber = (lastTicketData.ticketNumber || 0) + 1;
    }

    return {
        ticket: `ticket${newTicketNumber}`,
        ticketNumber: newTicketNumber,
    };
}

// Xử lý gửi form
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const maSO = form.maSO.value.trim();

    const formData = {
        maSO: maSO,
        maDHGHTK: form.maDHGHTK.value.trim(),
        deliveryname: form.deliveryname.value.trim(),
        issueType: form.issueType.value.trim(),
        sendingStore: form.sendingStore.value.trim(),
        receivingStore: form.receivingStore.value.trim(),
        solutionDirection: form.solutionDirection.value.trim(),
        compensationType: form.compensationType.value.trim(),
        compensationAmount: form.compensationAmount.value.trim(),
        suCo: form.suCo.value.trim(),
        note: form.note.value.trim(),
        thoiGianGui: formatDate(new Date()),
        status: form.status.value,
        followUpTime: form.followUpTime.value,
    };

    try {
        // Lấy thông tin user hiện tại từ Firebase Authentication
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const usernameField = await getUserInfo(user.uid);

                // Gắn thông tin username vào dữ liệu
                formData.username = usernameField;

                // Tạo mã ticket tự động
                const ticketData = await generateTicketNumber();
                formData.ticket = ticketData.ticket;
                formData.ticketNumber = ticketData.ticketNumber;

                // Lưu dữ liệu vào Firestore với mã SO là ID
                const docRef = doc(db, "incidentReports", formData.maSO);
                await setDoc(docRef, formData);

                Swal.fire({
                    title: 'Thành công!',
                    text: `Đã cập nhật thành công. Mã ticket: #${ticketData.ticket}`,
                    icon: 'success',
                    confirmButtonText: 'OK'
                });

                form.reset();
            } else {
                throw new Error("Người dùng chưa đăng nhập.");
            }
        });
    } catch (error) {
        Swal.fire({
            title: 'Thất bại!',
            text: 'Có lỗi xảy ra, vui lòng thử lại.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        console.error("Error adding document: ", error);
    }
});
