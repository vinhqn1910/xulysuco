import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.8/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/9.6.8/firebase-firestore.js";

// Firebase Configuration
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById('incidentForm');

// Hàm định dạng số với dấu phẩy
function formatNumberWithCommas(value) {
  const number = value.replace(/[^0-9]/g, '');
  return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Lắng nghe sự kiện nhập liệu và định dạng lại số tiền
document.getElementById('phiNhapDSD').addEventListener('input', function (e) {
  const input = e.target;
  const cursorPosition = input.selectionStart;
  input.value = formatNumberWithCommas(input.value);
  input.setSelectionRange(cursorPosition, cursorPosition);
});

// Hàm định dạng thời gian theo ngày/tháng/năm giờ:phút:giây
function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Hàm tạo mã ticket tự động
async function generateTicket() {
  const ticketCollection = collection(db, "incidentReports");
  const q = query(ticketCollection, orderBy("ticketNumber", "desc"), limit(1));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const lastTicketNumber = querySnapshot.docs[0].data().ticketNumber || 0; // Lấy ticketNumber
    return {
      ticket: `ticket${lastTicketNumber + 1}`,
      ticketNumber: lastTicketNumber + 1
    };
  } else {
    return {
      ticket: "ticket1",
      ticketNumber: 1
    };
  }
}

// Kiểm tra xem mã SO đã tồn tại trong hệ thống chưa
async function checkIfSOExists(maSO) {
  const incidentCollection = collection(db, "incidentReports");
  const q = query(incidentCollection, where("maSO", "==", maSO));
  const querySnapshot = await getDocs(q);
  return querySnapshot; // Trả về kết quả query để có thể lấy mã ticket
}

// Xử lý gửi form
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const maSO = form.maSO.value.trim();
  const formData = {
    maSO: maSO,
    maDHGHTK: form.maDHGHTK.value.trim(),
    deliveryname: form.deliveryname.value.trim(),
    suCo: form.suCo.value.trim(),
    userbaocao: form.userbaocao.value.trim(),
    phiNhapDSD: parseInt(form.phiNhapDSD.value.replace(/,/g, '')),
    note: form.note.value.trim(),
    thoiGianHen: form.thoiGian.value,
    thoiGianGui: formatDateTime(new Date()),
    status: "Tạo mới",
    issueType: "giao hàng"
  };

  try {
    // Thực hiện đồng thời kiểm tra mã SO và tạo ticket
    const [querySnapshot, ticketData] = await Promise.all([
      checkIfSOExists(maSO),
      generateTicket()
    ]);

    if (!querySnapshot.empty) {
      const existingTicket = querySnapshot.docs[0].data().ticket;
      Swal.fire({
        title: `Cập nhật trùng TICKET: #${existingTicket}`,
        text: 'Vui lòng liên hệ để chỉnh sửa.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    } else {
      formData.ticket = ticketData.ticket;
      formData.ticketNumber = ticketData.ticketNumber;

      // Lưu dữ liệu vào Firestore
      const docRef = doc(db, "incidentReports", formData.maSO);
      await setDoc(docRef, formData);

      Swal.fire({
        title: 'Thành công!',
        text: `Đã cập nhật thành công. Mã ticket: #${formData.ticket}`,
        icon: 'success',
        confirmButtonText: 'OK'
      });

      form.reset();
    }
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

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault();
    alert('Action not allowed!');
  }
});