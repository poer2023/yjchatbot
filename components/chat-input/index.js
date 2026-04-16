Component({
  properties: {
    disabled: {
      type: Boolean,
      value: false,
    },
    placeholder: {
      type: String,
      value: "想了解什么知识，快来问问我！",
    },
    value: {
      type: String,
      value: "",
    },
    showSearchChips: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    canSend: false,
    internalValue: "",
    isVoiceCancel: false,
    isVoiceRecording: false,
    searchChips: [
      {
        active: false,
        icon: "../../assets/icons/legal-search.svg",
        id: "legal",
        label: "法律搜索",
      },
      {
        active: false,
        icon: "../../assets/icons/globe-blue.svg",
        id: "web",
        label: "联网搜索",
      },
      {
        active: false,
        icon: "../../assets/icons/academic-search.svg",
        id: "academic",
        label: "学术搜索",
      },
      {
        active: false,
        icon: "../../assets/icons/knowledge-search.svg",
        id: "knowledge",
        label: "知识库搜索",
      },
    ],
    voiceBars: [20, 26, 24, 30, 22, 28, 24, 32, 26, 22, 28, 30, 24, 34, 26, 22, 30, 24, 28, 32],
    voiceMode: false,
  },

  observers: {
    value(nextValue) {
      const value = nextValue || "";
      if (value !== this.data.internalValue) {
        this.setData({
          canSend: !!value.trim(),
          internalValue: value,
        });
      }
    },
  },

  methods: {
    cacheHoldRect(callback) {
      const query = this.createSelectorQuery();
      query
        .select("#voice-hold-zone")
        .boundingClientRect((rect) => {
          this.holdRect = rect || null;
          if (typeof callback === "function") {
            callback(rect || null);
          }
        })
        .exec();
    },

    clearVoiceWaveTimer() {
      if (this.voiceWaveTimer) {
        clearInterval(this.voiceWaveTimer);
        this.voiceWaveTimer = null;
      }
    },

    startVoiceWaveAnimation() {
      this.clearVoiceWaveTimer();
      this.voiceWaveTimer = setInterval(() => {
        const next = (this.data.voiceBars || []).map(() => 20 + Math.round(Math.random() * 16));
        this.setData({
          voiceBars: next,
        });
      }, 180);
    },

    stopVoiceRecording(resetCancel) {
      this.clearVoiceWaveTimer();
      this.setData({
        isVoiceCancel: !!resetCancel ? false : this.data.isVoiceCancel,
        isVoiceRecording: false,
      });
    },

    handleVoiceExit() {
      this.clearVoiceWaveTimer();
      this.holdRect = null;
      this.setData({
        isVoiceCancel: false,
        isVoiceRecording: false,
        voiceMode: false,
      });
    },

    handleVoiceHoldStart() {
      if (this.data.disabled) {
        return;
      }
      this.cacheHoldRect();
      this.setData({
        isVoiceCancel: false,
        isVoiceRecording: true,
      });
      this.startVoiceWaveAnimation();
    },

    handleVoiceHoldMove(event) {
      if (!this.data.isVoiceRecording) {
        return;
      }
      const touch = event.touches && event.touches[0];
      const rect = this.holdRect;
      if (!touch || !rect) {
        return;
      }
      const outside =
        touch.clientX < rect.left ||
        touch.clientX > rect.right ||
        touch.clientY < rect.top ||
        touch.clientY > rect.bottom;
      if (outside !== this.data.isVoiceCancel) {
        this.setData({
          isVoiceCancel: outside,
        });
      }
    },

    handleVoiceHoldEnd() {
      if (!this.data.isVoiceRecording) {
        return;
      }
      const cancelled = this.data.isVoiceCancel;
      this.stopVoiceRecording(true);
      this.triggerEvent("stub", {
        kind: cancelled ? "voice-cancel" : "voice-send",
      });
    },

    handleVoiceHoldCancel() {
      if (!this.data.isVoiceRecording) {
        return;
      }
      this.stopVoiceRecording(true);
      this.triggerEvent("stub", {
        kind: "voice-cancel",
      });
    },

    toggleSearchChip(kind) {
      let enabled = false;
      const next = (this.data.searchChips || []).map((chip) => {
        if (chip.id !== kind) {
          return chip;
        }
        enabled = !chip.active;
        return {
          ...chip,
          active: enabled,
        };
      });
      this.setData({
        searchChips: next,
      });
      return enabled;
    },

    handleSearchChipTap(event) {
      if (this.data.disabled) {
        return;
      }
      const kind = event.currentTarget.dataset.kind;
      if (!kind) {
        return;
      }
      const enabled = this.toggleSearchChip(kind);
      this.triggerEvent("stub", {
        enabled,
        kind,
      });
    },

    emitSend() {
      const value = (this.data.internalValue || "").trim();
      if (this.data.disabled || !value) {
        return;
      }

      this.triggerEvent("send", {
        value,
      });
    },

    handleInput(event) {
      const value = event.detail.value || "";
      this.setData({
        canSend: !!value.trim(),
        internalValue: value,
      });
      this.triggerEvent("change", {
        value,
      });
    },

    handleQuickAction(event) {
      if (this.data.disabled) {
        return;
      }
      const kind = event.currentTarget.dataset.kind || "default";
      if (kind === "voice") {
        this.setData({
          voiceMode: true,
        });
        this.cacheHoldRect();
        return;
      }
      this.triggerEvent("stub", {
        kind,
      });
    },

    handleSendTap() {
      this.emitSend();
    },

    noop() {},
  },

  lifetimes: {
    detached() {
      if (this.voiceWaveTimer) {
        clearInterval(this.voiceWaveTimer);
      }
    },
  },
});
