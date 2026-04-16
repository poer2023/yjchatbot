Component({
  properties: {
    cancelText: {
      type: String,
      value: "取消",
    },
    options: {
      type: Array,
      value: [],
    },
    visible: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    handleCancel() {
      this.triggerEvent("close");
    },

    handleMaskTap() {
      this.triggerEvent("close");
    },

    handleOptionTap(event) {
      const detail = {
        key: event.currentTarget.dataset.key || "",
        label: event.currentTarget.dataset.label || "",
      };
      this.triggerEvent("select", detail);
    },

    noop() {},
  },
});
