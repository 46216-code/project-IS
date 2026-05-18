// Posts storage
let memoryPosts = [];
let selectedPostId = null;

// Default images
const defaultImages = {
    Cooperation:
        "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400",

    Commission:
        "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400",

    Volunteer:
        "https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400",

    "Meet-up":
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400"
};

// Open create modal
function openCreateModal() {
    document.getElementById("createPostForm").reset();

    toggleTypeFields();

    document
        .getElementById("createModal")
        .classList.remove("hidden");
}

// Close modal
function closeModal(modalId) {
    document
        .getElementById(modalId)
        .classList.add("hidden");
}

// Toggle form fields
function toggleTypeFields() {

    const type =
        document.getElementById("postType").value;

    const commissionField =
        document.getElementById("commissionField");

    const locationField =
        document.getElementById("locationField");

    // Commission
    commissionField.classList.toggle(
        "hidden",
        type !== "Commission"
    );

    // Meet-up
    locationField.classList.toggle(
        "hidden",
        type !== "Meet-up"
    );

    if (type === "Meet-up") {
        document
            .getElementById("postLocation")
            .setAttribute("required", "true");
    } else {
        document
            .getElementById("postLocation")
            .removeAttribute("required");
    }
}

// Create post
function handleCreatePost(event) {

    event.preventDefault();

    const type =
        document.getElementById("postType").value;

    const newPost = {
        id: Date.now(),

        title:
            document.getElementById("postTitle").value,

        desc:
            document.getElementById("postDesc").value,

        type: type,

        limit:
            document.getElementById("postLimit").value,

        joined: 0,

        budget:
            type === "Commission"
                ? document.getElementById("postBudget").value
                : null,

        location:
            type === "Meet-up"
                ? document.getElementById("postLocation").value
                : null,

        image:
            defaultImages[type] ||
            defaultImages.Cooperation
    };

    memoryPosts.push(newPost);

    closeModal("createModal");

    renderPosts();
}

// Render posts
function renderPosts() {

    const grid =
        document.getElementById("boardGrid");

    const emptyState =
        document.getElementById("emptyState");

    // Empty state
    if (memoryPosts.length === 0) {

        emptyState.classList.remove("hidden");

        grid.classList.add(
            "items-center",
            "justify-center"
        );

        const elements =
            grid.querySelectorAll(".post-card");

        elements.forEach(el => el.remove());

        return;
    }

    emptyState.classList.add("hidden");

    grid.classList.remove(
        "items-center",
        "justify-center"
    );

    // Remove old cards
    const existingCards =
        grid.querySelectorAll(".post-card");

    existingCards.forEach(card => card.remove());

    // Create cards
    memoryPosts.forEach(post => {

        const card = document.createElement("div");

        card.className =
            "post-card border-2 border-gray-300 rounded-lg p-4 flex gap-4 bg-white shadow-sm hover:shadow-md transition";

        let badgeContent =
            post.type === "Commission"
                ? `Commission $ ${post.budget ? `(${post.budget})` : ""}`
                : (
                    post.type === "Meet-up"
                        ? `<i class="fa-solid fa-location-dot"></i> Meet-up`
                        : (
                            post.type === "Volunteer"
                                ? `<i class="fa-solid fa-broom"></i> Volunteer`
                                : `<i class="fa-solid fa-users"></i> Cooperation`
                        )
                );

        card.innerHTML = `
            <img src="${post.image}"
                class="w-1/3 h-32 object-cover rounded border border-gray-300"
                alt="">

            <div class="flex-1 flex flex-col justify-between">

                <div>
                    <h3 class="text-[#ff5100] text-xl font-bold line-clamp-1">
                        ${post.title}
                    </h3>

                    ${post.location
                        ? `<p class="text-xs text-gray-500 font-bold">
                            <i class="fa-solid fa-map-marker-alt text-orange-500"></i>
                            ${post.location}
                        </p>`
                        : ""
                    }

                    <p class="text-red-500 text-xs mt-1 line-clamp-2">
                        ${post.desc}
                    </p>
                </div>

                <div class="flex justify-end gap-2 mt-2">

                    <span class="bg-[#ff6200] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-orange-700">
                        ${badgeContent}
                    </span>

                    <button onclick="viewPostDetails(${post.id})"
                        class="bg-[#41cf43] text-white px-4 py-1 rounded-full text-xs font-bold border border-green-700 shadow-sm flex items-center gap-1 hover:bg-green-600 transition">

                        สมัคร

                        <span class="bg-emerald-700 text-white text-[10px] px-1 rounded-full">
                            ${post.joined}/${post.limit}
                        </span>
                    </button>

                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// View details
function viewPostDetails(id) {

    selectedPostId = id;

    const post =
        memoryPosts.find(p => p.id === id);

    if (!post) return;

    document.getElementById("modalTitle").innerText =
        post.title;

    document.getElementById("modalDesc").innerText =
        post.desc;

    document.getElementById("modalImage").src =
        post.image;

    document.getElementById("modalSlots").innerText =
        `${post.joined}/${post.limit}`;

    // Location
    const locContainer =
        document.getElementById("modalLocationContainer");

    if (post.location) {

        locContainer.classList.remove("hidden");

        document.getElementById("modalLocationText").innerText =
            post.location;

    } else {

        locContainer.classList.add("hidden");
    }

    // Badge
    const badge =
        document.getElementById("modalTypeBadge");

    badge.innerText =
        post.type === "Commission"
            ? "Commission $"
            : post.type;

    // Open
    document
        .getElementById("detailsModal")
        .classList.remove("hidden");
}

// Open confirm modal
function openConfirmModal() {

    const post =
        memoryPosts.find(p => p.id === selectedPostId);

    if (!post) return;

    document.getElementById("confirmTitle").innerText =
        post.title;

    document.getElementById("confirmImage").src =
        post.image;

    document
        .getElementById("confirmModal")
        .classList.remove("hidden");
}

// Submit application
function submitApplication() {

    const post =
        memoryPosts.find(p => p.id === selectedPostId);

    if (post) {

        if (
            parseInt(post.joined) >=
            parseInt(post.limit)
        ) {

            alert("ขออภัย! กิจกรรมนี้คนเข้าร่วมเต็มแล้ว");

        } else {

            post.joined =
                parseInt(post.joined) + 1;

            alert("สมัครเข้าร่วมสำเร็จเรียบร้อยแล้ว!");
        }
    }

    closeModal("confirmModal");
    closeModal("detailsModal");

    renderPosts();
}