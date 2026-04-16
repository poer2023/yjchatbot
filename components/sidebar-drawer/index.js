Component({
  properties: {
    activeSessionId: {
      type: String,
      value: "",
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    groups: {
      type: Array,
      value: [],
    },
    profileName: {
      type: String,
      value: "凡 x",
    },
    profileInitial: {
      type: String,
      value: "凡",
    },
    topOffset: {
      type: Number,
      value: 24,
    },
    visible: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    handleClose() {
      this.triggerEvent("close");
    },

    handleSelect(event) {
      if (this.data.disabled) {
        this.triggerEvent("blocked");
        return;
      }

      this.triggerEvent("select", {
        sessionId: event.currentTarget.dataset.id,
      });
    },

    handleSettings() {
      if (this.data.disabled) {
        this.triggerEvent("blocked");
        return;
      }

      this.triggerEvent("settings");
    },

    noop() {},
  },
});
