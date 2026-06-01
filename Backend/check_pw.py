import bcrypt
h = "$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK"
result = bcrypt.checkpw("test1234".encode("utf-8"), h.encode("utf-8"))
print("test1234 matches:", result)
