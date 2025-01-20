import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Hàm lấy ngày hôm nay theo định dạng yyyy-mm-dd
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Gán giá trị mặc định cho startDate và endDate
document.addEventListener("DOMContentLoaded", () => {
    const today = getTodayDate();
    document.getElementById("startDate").value = today;
    document.getElementById("endDate").value = today;
});

// Function to format date
function formatDateToCompare(date, time) {
    const [day, month, year] = date.split("/"); // Tách ngày, tháng, năm từ chuỗi dd/mm/yyyy
    return `${day}/${month}/${year} ${time}`;
}

// Function to fetch and display data
async function searchIssues(startDate, endDate, issueType, status, username, searchTerm, searchType) {
    const issueTableBody = document.getElementById("issue-table-body");
    issueTableBody.innerHTML = ""; // Clear previous results

    const collectionRef = collection(db, "incidentReports");

    try {
        const querySnapshot = await getDocs(collectionRef);

        if (querySnapshot.empty) {
            issueTableBody.innerHTML = "<tr><td colspan='10'>Không có dữ liệu</td></tr>";
            return;
        }

        let matchingRecords = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const recordTime = data.thoiGianGui || ""; // Lấy thời gian gửi từ dữ liệu Firestore

            // Chuyển ngày bắt đầu và ngày kết thúc sang định dạng so sánh
            const formattedStartDate = startDate ? `${startDate} 00:00:00` : null;
            const formattedEndDate = endDate ? `${endDate} 23:59:59` : null;

            // Kiểm tra điều kiện lọc
            if (
                (!formattedStartDate || recordTime >= formattedStartDate) &&
                (!formattedEndDate || recordTime <= formattedEndDate) &&
                (!issueType || data.issueType === issueType) &&
                (!username || data.username === username) &&
                (!status || data.status === status) &&
                (!searchTerm || data[searchType] === searchTerm)
            ) {
                matchingRecords.push({ ...data, id: doc.id }); // Gắn thêm ID của Firestore
            }
        });

        // Sắp xếp và hiển thị dữ liệu
        matchingRecords.sort((a, b) => (a.ticket || "").localeCompare(b.ticket || ""));

        let count = 0;
        matchingRecords.forEach((data) => {
            const row = `<tr>
                <td>${++count}</td>
                <td>${data.maSO || "-"}</td>
                <td>${data.maDHGHTK || "-"}</td>
                <td><a href="ticket-detail.html?ticket=${data.ticket}" target="_blank">${data.ticket || "-"}</a></td>
                <td>${data.issueType || "-"}</td>
                <td>${data.sendingStore || "-"}</td>
                <td>${data.receivingStore || "-"}</td>
                <td>${data.status || "-"}</td>
                <td>${data.username || "-"}</td>
                <td>${data.thoiGianGui || "-"}</td>
            </tr>`;
            issueTableBody.innerHTML += row;
        });

        if (count === 0) {
            issueTableBody.innerHTML = "<tr><td colspan='10'>Không có dữ liệu</td></tr>";
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Đã xảy ra lỗi khi tìm kiếm!");
    }
}

// Event listener for search form
document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const startDateInput = document.getElementById("startDate").value; // yyyy-mm-dd
    const endDateInput = document.getElementById("endDate").value;   // yyyy-mm-dd

    // Chuyển sang định dạng dd/mm/yyyy
    const startDate = startDateInput.split("-").reverse().join("/");
    const endDate = endDateInput.split("-").reverse().join("/");

    const issueType = document.getElementById("issueType").value.trim();
    const status = document.getElementById("status").value.trim();
    const username = document.getElementById("username").value.trim();
    const searchTerm = document.getElementById("searchTerm").value.trim();
    const searchType = document.getElementById("searchType").value.trim();

    searchIssues(startDate, endDate, issueType, status, username, searchTerm, searchType);
});

// Hàm lấy thông tin người dùng từ Collection employees
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

// Hàm nhận sự cố mới và hiển thị trong bảng
async function receiveTicket() {
    const issueTableBody = document.getElementById("issue-table-body");

    try {
        // Lắng nghe sự thay đổi trạng thái đăng nhập của người dùng
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const uid = user.uid; // Lấy UID người dùng từ Firebase Authentication

                // Lấy thông tin người dùng từ collection 'employees' giống như trong code dưới
                try {
                    const usernameField = await getUserInfo(uid);
                    const currentUser = usernameField; // Gán tên người dùng lấy được từ Firestore

                    const collectionRef = collection(db, "incidentReports");

                    // Lọc sự cố có trạng thái "Tạo mới"
                    const q = query(collectionRef, where("status", "==", "Tạo mới"));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        alert("Không có sự cố nào ở trạng thái Tạo mới!");
                        return;
                    }

                    // Chọn sự cố đầu tiên
                    const doc = querySnapshot.docs[0];
                    const data = doc.data();

                    // Cập nhật trạng thái và User trong Firestore
                    await updateDoc(doc.ref, {
                        status: "Đang xử lý",
                        username: currentUser, // Cập nhật tên người dùng từ Firestore
                    });

                    // Hiển thị sự cố đã nhận vào bảng
                    issueTableBody.innerHTML = ` 
                        <tr>
                            <td>1</td>
                            <td>${data.maSO || "-"}</td>
                            <td>${data.maDHGHTK || "-"}</td>
                            <td><a href="ticket-detail.html?ticket=${data.ticket}" target="_blank">${data.ticket || "-"}</a></td>
                            <td>${data.issueType || "-"}</td>
                            <td>${data.sendingStore || "-"}</td>
                            <td>${data.receivingStore || "-"}</td>
                            <td>Đang xử lý</td> <!-- Trạng thái đã cập nhật -->
                            <td>${currentUser}</td> <!-- User đã gán -->
                            <td>${data.thoiGianGui || "-"}</td>
                        </tr>`;

                    alert(`Đã nhận sự cố mới với Mã Ticket: ${data.ticket}`);
                } catch (error) {
                    console.error("Lỗi khi lấy thông tin người dùng:", error);
                    alert("Không tìm thấy thông tin người dùng.");
                }

            } else {
                alert("Người dùng chưa đăng nhập.");
            }
        });
    } catch (error) {
        console.error("Lỗi khi nhận sự cố mới:", error);
        alert("Đã xảy ra lỗi khi nhận sự cố mới!");
    }
}


// Gắn hàm vào đối tượng window
window.receiveTicket = receiveTicket;

// Hàm xuất dữ liệu ra Excel
function exportToExcel() {
    const table = document.getElementById("issue-table-body");
    const rows = table.querySelectorAll("tr");

    if (!rows.length) {
        alert("Không có dữ liệu để xuất!");
        return;
    }

    const data = [];
    // Lấy dữ liệu từ bảng
    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const rowData = Array.from(cells).map(cell => cell.textContent.trim());
        data.push(rowData);
    });

    // Thêm tiêu đề cột
    const headers = [
        "STT", "Mã SO", "Mã bill đối tác", "Ticket", "Loại sự cố",
        "Siêu thị gửi hàng", "Siêu thị nhận hàng", "Trạng thái", "User xử lý", "Thời gian tạo sự cố"
    ];
    data.unshift(headers);

    // Tạo workbook và worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IncidentReports");

    // Xuất file Excel
    XLSX.writeFile(workbook, "IncidentReports.xlsx");
}
document.getElementById("export-excel").addEventListener("click", exportToExcel);
