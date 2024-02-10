return {
    users: ["mariia"],
    actions: [
        {
            name: "Set Message",
            signature: [
                {
                    type: "text",
                    label: "Message"
                }
            ],
            fn: (d, message) => d.message = message
        }
    ],
    display: [
        d => [["Message"], [d?.message]]
    ]
}