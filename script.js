// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://vznmzjoouyxwosyrshzb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jnBAcgvSsdX465MooaAEUw_nsOHFkqv";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

let memoryPosts = [];
let loggedInUser = null;
const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

// GATHER CURRENT PAGE FILENAME
const currentPage = window.location.pathname.split("/").pop();

// UI INTERFACE TOGGLE (FOR SIGNUP-LOGIN PAGE)
function toggleAuthMode(mode) {
    const loginForm = document.getElementById('loginFormContainer');
    const signUpForm = document.getElementById('signUpFormContainer');
    const subTitle = document.getElementById('authSubtitle');

    if (!loginForm || !signUpForm) return;

    if(mode === 'signup') {
        loginForm.style.display = 'none';
        signUpForm.style.display = 'block';
        subTitle.innerText = "ลงทะเบียนข้อมูลบัญชีของคุณ เพื่อเริ่มใช้งานระบบบอร์ดเมือง";
    } else {
        signUpForm.style.display = 'none';
        loginForm.style.display = 'block';
        subTitle.innerText = "ยินดีต้อนรับ! เข้าสู่แพลตฟอร์มรวมตัวทำกิจกรรม";
    }
}

// REGISTER (SIGN UP) FUNCTION
async function handleSignUp(event) {
    event.preventDefault();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPass').value.trim();
    const avatarFile = document.getElementById('profileImageFile').files[0];
    const signUpBtn = document.getElementById('signUpBtn');

    if (password.length < 6) {
        return alert("รหัสผ่านสั้นเกินไป! กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
    }

    signUpBtn.innerText = "กำลังสร้างสิทธิ์เข้าถึง...";
    signUpBtn.disabled = true;

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({ 
        email, 
        password,
        options: {
            redirectTo: "https://project-is-mocha.vercel.app/"
        }
    });
    
    if (authError) {
        alert("เกิดปัญหาในการลงทะเบียนสมัครสมาชิก: " + authError.message);
        signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
        signUpBtn.disabled = false;
        return;
    }

    let avatarUrl = defaultAvatar;
    if (avatarFile && authData.user) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `avatars/${authData.user.id}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('activity-images').upload(filePath, avatarFile);
        
        if (!uploadError) {
            const { data: urlData } = supabaseClient.storage.from('activity-images').getPublicUrl(filePath);
            avatarUrl = urlData.publicUrl;
        }
    }

    if(authData.user) {
        await supabaseClient.from('profiles').insert([{ id: authData.user.id, username: email.split('@')[0], avatar_url: avatarUrl }]);
    }
    
    alert("สมัครสมาชิกสำเร็จ! คุณสามารถใช้บัญชีนี้ล็อกอินเข้าสู่ระบบได้ทันที");
    signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
    signUpBtn.disabled = false;
    toggleAuthMode('login');
}

// LOG IN FUNCTION
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.innerText = "กำลังตรวจสอบสิทธิ์...";
    loginBtn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    loginBtn.innerText = "เข้าสู่ระบบ (Log In)";
    loginBtn.disabled = false;

    if (error) {
        alert("ล็อกอินไม่สำเร็จ: " + error.message + " (กรุณาตรวจสอบว่ากรอกข้อมูลถูกต้อง หรือปิดการยืนยันทางอีเมลในคอนโซลของ Supabase แล้ว)");
    } else {
        // Redirect To Main Board page
        window.location.href = "index.html";
    }
}

// TRACK AUTH SESSION
function trackAuthSession() {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;
            
            // If user logged in and staying at login page, redirect to index.html
            if (currentPage === "signup-login.html" || currentPage === "") {
                window.location.href = "index.html";
            }

            // Sync user data onto index.html components
            if (document.getElementById('userDisplay')) {
                document.getElementById('userDisplay').innerText = loggedInUser.email.split('@')[0];
            }
            fetchPosts();
        } else {
            loggedInUser = null;
            // If user is unauthenticated and browsing index.html, force them back to login page
            if (currentPage === "index.html") {
                window.location.href = "signup-login.html";
            }
        }
    });
}

// FETCH POSTS FROM SUPABASE
async function fetchPosts() {
    const grid = document.getElementById('boardGrid');
    if (!grid) return;

    const { data, error } = await supabaseClient.from('posts').select('*').order('id', { ascending: false });
    if (!error && data) {
        memoryPosts = data;
        const emptyState = document.getElementById('emptyState');
        grid.querySelectorAll('.post-card').forEach(card => card.remove());
        
        if(memoryPosts.length === 0) { 
            if(emptyState) emptyState.classList.remove('hidden'); 
        } else { 
            if(emptyState) emptyState.classList.add('hidden'); 
        }
    }
}

// LOGOUT FUNCTION
async function handleLogout() {
    if(confirm("ต้องการออกจากระบบหรือไม่?")) {
        await supabaseClient.auth.signOut();
        window.location.href = "signup-login.html";
    }
}

// MODAL CONTROLS & DYNAMIC FIELDS
function openCreateModal() { 
    const modal = document.getElementById('createModal');
    if(modal) modal.classList.remove('hidden'); 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('hidden'); 
}

function toggleTypeFields() {
    const typeEl = document.getElementById('postType');
    const commField = document.getElementById('commissionField');
    const locField = document.getElementById('locationField');
    
    if(!typeEl) return;
    const type = typeEl.value;

    if(commField) commField.classList.toggle('hidden', type !== 'Commission');
    if(locField) locField.classList.toggle('hidden', type !== 'Meet-up');
}

// INITIALIZER ON LOAD
window.onload = function() { 
    trackAuthSession(); 
};